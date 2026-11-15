import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { POD_BUCKET, signPodUrl } from "@/services/storage/podService";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { forgetDispatchRoute } from "@/services/fleet/routePlanService";
import { notify, OFFICE, tripLabel } from "@/services/notifications/notify";
import { DELIVERY_STATUS, HELPER_STATUS, STOP_STATUS } from "@/app/lib/enums";
import { announceUnverifiedProof } from "@/services/dispatch/crewUpdateService";
import {
  checkPodScan,
  parseScanReport,
  RELAXED_PREFIX,
  sha256,
  storedNumbers,
  type StopPlace,
} from "@/services/storage/podScanCheck";
import { getPhotoChecks } from "@/services/settings/photoCheckSettings";
import { MAX_POD_PHOTOS, type PodScanReport } from "@/app/lib/podScan";
import {
  crewNotReadyReason,
  crewReadinessFor,
  getCrewAssignment,
  isUuid,
  releaseDispatchResources,
  TERMINAL_DISPATCH_STATUSES,
} from "@/services/dispatch/dispatchService";

// Statuses the crew app may set, and the statuses each may be reached from.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  [DELIVERY_STATUS.inTransit]: [
    DELIVERY_STATUS.assigned,
    DELIVERY_STATUS.accepted,
    DELIVERY_STATUS.inTransit,
    // A crew who reported arriving at a stop are in "Arrived" until they finish
    // it. Without this the finish was refused as an illegal transition, and the
    // arrival tap would have bricked the trip one stop in.
    DELIVERY_STATUS.arrived,
  ],
  [DELIVERY_STATUS.completed]: [DELIVERY_STATUS.inTransit, DELIVERY_STATUS.arrived],
};

// The statuses a trip is still in before it has left, where the whole crew
// having accepted is a precondition rather than a formality.
const STARTING_OUT: string[] = [
  DELIVERY_STATUS.pending,
  DELIVERY_STATUS.assigned,
  DELIVERY_STATUS.accepted,
];

const MAX_POD_BYTES = 10 * 1024 * 1024;

/** One receipt photo on its way through the checks and into the bucket. */
interface PodPhoto {
  file: File;
  bytes: ArrayBuffer;
  /** sha256 of the exact file. */
  hash: string;
  scan: PodScanReport | null;
  /** What the check left for the office. */
  flags: string[];
  /** The object path, once uploaded. */
  path: string;
}

// How far back a reused receipt photo is looked for, on this trip and this
// crew member's other trips.
const DUPLICATE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

async function releaseResources(dispatchID: string): Promise<void> {
  try {
    await releaseDispatchResources(dispatchID);
  } catch (error) {
    console.error("[Status API] Failed to release truck and crew:", error);
  }
}

export async function POST(request: Request) {
  const { auth, response } = await authorize(request, CREW_ROLES);
  if (response) return response;

  try {
    // 1. Parse FormData
    const formData = await request.formData();
    const dispatchID = formData.get("dispatchID") as string | null;
    const status = formData.get("status") as string | null;
    const stepValue = formData.get("current_step") as string | null;
    const remarks = (formData.get("remarks") as string | null) || "";
    const receiverName = (formData.get("receiverName") as string | null) || "";
    const title = (formData.get("title") as string | null) || "";
    const branchIDValue = formData.get("branchID") as string | null;
    const pickupIDValue = formData.get("pickupID") as string | null;
    // One stop may carry several receipt photos, each sent as "podImage" with
    // its own "scan" report beside it, in the same order.
    const files = formData.getAll("podImage").filter((value): value is File => value instanceof File && value.size > 0);
    const scanReports = formData.getAll("scan").map((value) => (typeof value === "string" ? value : null));

    if (!isUuid(dispatchID) || !status) {
      return NextResponse.json({ message: "Missing or invalid dispatchID or status" }, { status: 400 });
    }

    if (!ALLOWED_TRANSITIONS[status]) {
      return NextResponse.json({ message: `Status "${status}" cannot be set from the crew app` }, { status: 400 });
    }

    // 2. Only the assigned driver or an accepted helper may update the trip.
    const assignment = await getCrewAssignment(dispatchID, auth.employee.employeeID);
    if (!assignment) {
      return NextResponse.json(
        { message: "Only the assigned driver or helper can update this delivery." },
        { status: 403 },
      );
    }

    // A helper who has not accepted yet cannot act on the trip.
    if (!assignment.isDriver && assignment.helper?.status !== HELPER_STATUS.accepted) {
      return NextResponse.json(
        {
          message:
            "Accept this assignment first: your helper assignment is " +
            `"${assignment.helper?.status ?? "Pending"}".`,
        },
        { status: 403 },
      );
    }

    const current = assignment.dispatch;
    const currentStep = current.current_step ?? 0;
    const parsedStep = stepValue !== null && stepValue !== "" ? parseInt(stepValue, 10) : NaN;
    const nextStep = Number.isNaN(parsedStep) ? currentStep : parsedStep;

    // A retried request (flaky mobile network) must not apply twice.
    if (current.status === status && nextStep <= currentStep) {
      // If releasing the truck and crew failed the first time, the retry is
      // the chance to finish the job; setting them free twice is harmless.
      if (status === DELIVERY_STATUS.completed) await releaseResources(dispatchID);

      return NextResponse.json({ message: "Status already up to date", status, podUrl: null });
    }

    if (TERMINAL_DISPATCH_STATUSES.includes(current.status)) {
      return NextResponse.json({ message: `Dispatch is already ${current.status}.` }, { status: 409 });
    }

    if (!ALLOWED_TRANSITIONS[status].includes(current.status)) {
      return NextResponse.json(
        { message: `Cannot change a dispatch from "${current.status}" to "${status}".` },
        { status: 409 },
      );
    }

    if (nextStep < currentStep) {
      return NextResponse.json(
        { message: "This trip has already progressed past that step. Please refresh.", current_step: currentStep },
        { status: 409 },
      );
    }

    // Nobody leaves until the whole crew has agreed to go.
    //
    // The driver accepting set the dispatch to Accepted, and the start button
    // looked at nothing else - so a helper who had never answered was no
    // obstacle, and a two-person job could leave with one person on it. The
    // office found out at the warehouse.
    //
    // Only checked at the start. Once the truck is rolling, refusing to record
    // a delivery that has already happened because of a row somebody never
    // answered would lose the proof rather than the crew.
    if (status === DELIVERY_STATUS.inTransit && STARTING_OUT.includes(current.status)) {
      const readiness = (await crewReadinessFor([dispatchID])).get(dispatchID);
      const blocked = readiness
        ? crewNotReadyReason(readiness, { isDriver: assignment.isDriver })
        : null;
      if (blocked) {
        return NextResponse.json({ message: blocked }, { status: 409 });
      }
    }

    // The stop being completed must belong to this dispatch's order.
    let branchID: number | null = null;
    // Where the stop is and when the crew said they got there, for the scan.
    let place: StopPlace = { latitude: null, longitude: null, arrivedAt: null };
    if (branchIDValue) {
      const parsedBranch = parseInt(branchIDValue, 10);
      if (!Number.isNaN(parsedBranch)) {
        const { data: stop } = await supabase
          .from("BranchStops")
          .select("branchID, deliveryLat, deliverLong, arrivedAt")
          .eq("branchID", parsedBranch)
          .eq("orderID", current.orderID)
          .maybeSingle();
        branchID = stop?.branchID ?? null;
        if (stop) {
          place = {
            latitude: Number(stop.deliveryLat) || null,
            longitude: Number(stop.deliverLong) || null,
            arrivedAt: (stop.arrivedAt as string | null) ?? null,
          };
        }
      }
    }

    // Same for the collection point, when this update is a pickup.
    let pickupID: number | null = null;
    if (pickupIDValue) {
      const parsedPickup = parseInt(pickupIDValue, 10);
      if (!Number.isNaN(parsedPickup)) {
        const { data: pickup } = await supabase
          .from("PickupStops")
          .select("pickupID, pickupLat, pickupLong, arrivedAt")
          .eq("pickupID", parsedPickup)
          .eq("orderID", current.orderID)
          .maybeSingle();
        pickupID = pickup?.pickupID ?? null;
        if (pickup) {
          place = {
            latitude: Number(pickup.pickupLat) || null,
            longitude: Number(pickup.pickupLong) || null,
            arrivedAt: (pickup.arrivedAt as string | null) ?? null,
          };
        }
      }
    }

    // A real stop - a warehouse or a branch - is where goods change hands, and
    // the record of that is a signed receipt. The crew app already asked for
    // one; the server did not, so a stop could still be closed on nothing.
    const isStop = branchID !== null || pickupID !== null;
    const hasFile = files.length > 0;

    if (isStop && !hasFile) {
      return NextResponse.json(
        { message: "A photo of the signed proof of delivery is required for this stop." },
        { status: 400 },
      );
    }
    if (isStop && !receiverName.trim()) {
      return NextResponse.json(
        { message: "The receiver's name is required for this stop." },
        { status: 400 },
      );
    }
    if (files.length > MAX_POD_PHOTOS) {
      return NextResponse.json(
        { message: `A stop can have at most ${MAX_POD_PHOTOS} proof of delivery photos.` },
        { status: 400 },
      );
    }

    // "Photo 2: ..." when there is more than one, so the crew know which to retake.
    const which = (index: number, message: string) => (files.length > 1 ? `Photo ${index + 1}: ${message}` : message);

    const photos: PodPhoto[] = [];

    // 3. Check, then upload, the proof-of-delivery photos
    for (const [index, file] of files.entries()) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ message: which(index, "Proof of delivery must be an image") }, { status: 400 });
      }
      if (file.size > MAX_POD_BYTES) {
        return NextResponse.json({ message: which(index, "Proof of delivery image must be 10 MB or smaller") }, { status: 400 });
      }
      const bytes = await file.arrayBuffer();
      photos.push({
        file,
        bytes,
        hash: sha256(bytes),
        scan: isStop ? parseScanReport(scanReports[index] ?? null) : null,
        flags: [],
        path: "",
      });
    }

    // Checked before anything is written. A refused scan leaves the stop
    // exactly as it was - no object in the bucket, no row, no step taken -
    // so the crew rescan that photo and send the same request.
    //
    // Every photo is a receipt page and is checked like the first. They are
    // compared with proofs already on file, not with each other: the pages of
    // one receipt share its form, its DR number and its date, and would look
    // like the same page taken twice. The same file twice is still refused.
    //
    // The office's receipt-check switch decides what a failed check does:
    // strict refuses the stop, relaxed lets it close with the reasons written
    // on the photo, so it lands in Proof Review.
    const checkMode = isStop && photos.length > 0 ? (await getPhotoChecks()).podReceiptCheck : "strict";
    const addedTwice = new Set<number>();
    if (isStop && photos.length > 0) {
      const seenHashes = new Set<string>();
      for (const [index, photo] of photos.entries()) {
        if (seenHashes.has(photo.hash)) {
          const reason = "This photo was added twice. Remove it, or scan the next page.";
          if (checkMode === "relaxed") {
            addedTwice.add(index);
          } else {
            const refusal = which(index, reason);
            return NextResponse.json({ message: refusal, reasons: [refusal], photoIndex: index }, { status: 422 });
          }
        }
        seenHashes.add(photo.hash);
      }

      const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
      const wantsEarlier = photos.some((photo) => photo.scan?.dHash);
      const [{ data: sameFile }, earlierProofs] = await Promise.all([
        supabase.from("PODPhotos").select("imageHash").in("imageHash", [...seenHashes]),
        wantsEarlier
          ? supabase
              .from("POD")
              .select("podID")
              .or(`dispatchID.eq.${dispatchID},recordedBy.eq.${auth.employee.employeeID}`)
              .gte("deliveredAt", since)
              .order("deliveredAt", { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [] as { podID: string }[] }),
      ]);
      const earlierIDs = ((earlierProofs.data ?? []) as { podID: string }[]).map((row) => row.podID);
      const { data: earlier } = earlierIDs.length
        ? await supabase
            .from("PODPhotos")
            .select("imageDHash, docNumbers")
            .in("podID", earlierIDs)
            .not("imageDHash", "is", null)
        : { data: [] as { imageDHash: string | null; docNumbers: string | null }[] };

      const usedHashes = new Set(((sameFile ?? []) as { imageHash: string | null }[]).map((row) => row.imageHash));
      const earlierScans = ((earlier ?? []) as { imageDHash: string | null; docNumbers: string | null }[]).map((row) => ({
        dHash: row.imageDHash,
        docNumbers: storedNumbers(row.docNumbers),
      }));

      for (const [index, photo] of photos.entries()) {
        const check = checkPodScan({
          report: photo.scan,
          place,
          now: Date.now(),
          sameFileUsed: usedHashes.has(photo.hash),
          earlierScans,
          mode: checkMode,
        });
        if (check.refusal) {
          const refusal = which(index, check.refusal);
          return NextResponse.json({ message: refusal, reasons: [refusal], photoIndex: index }, { status: 422 });
        }
        photo.flags = addedTwice.has(index)
          ? [`${RELAXED_PREFIX}This photo was added twice.`, ...check.flags]
          : check.flags;
      }
    }

    // Uploaded only once every photo has passed. If one upload fails, the ones
    // already in the bucket are taken out again, so a retry starts clean.
    const stamp = Date.now();
    for (const [index, photo] of photos.entries()) {
      const safeName = photo.file.name.replace(/[^a-zA-Z0-9.]/g, "");
      const fileName = `pod-${dispatchID}-${stamp}-${index + 1}-${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from(POD_BUCKET)
        .upload(fileName, photo.bytes, { contentType: photo.file.type });

      if (uploadErr) {
        console.error("[Status API] Image Upload Error:", uploadErr);
        const uploaded = photos.slice(0, index).map((earlier) => earlier.path);
        if (uploaded.length) {
          const { error: cleanupErr } = await supabase.storage.from(POD_BUCKET).remove(uploaded);
          if (cleanupErr) console.error("[Status API] Could not remove the photos already uploaded:", cleanupErr.message);
        }
        return NextResponse.json({ message: "Failed to upload Proof of Delivery image" }, { status: 502 });
      }

      // The object path, not a public URL: the photo is a delivery receipt
      // with a customer name on it, and getPublicUrl hands out a permanent
      // unauthenticated link to it. Screens are given a signed URL instead.
      photo.path = fileName;
    }

    const first = photos[0] ?? null;
    const podPath = first?.path || null;
    const podUrl = podPath ? await signPodUrl(podPath) : null;
    const podFileType = first ? first.file.type || null : null;
    const scan: PodScanReport | null = first?.scan ?? null;
    const imageHash = isStop ? (first?.hash ?? null) : null;
    // What the office is told: every photo's flags, each said once, named by
    // photo when there are several.
    const scanFlags = [...new Set(photos.flatMap((photo, index) => photo.flags.map((flag) => which(index, flag))))];

    // 4. Update DispatchOrder, appending crew remarks to the existing notes
    const updatePayload: Record<string, unknown> = { status, current_step: nextStep };

    if (remarks || podPath) {
      const received = receiverName ? `Received by ${receiverName}. ` : "";
      updatePayload.dispatchNote =
        `${current.dispatchNote || ""}\n[${title || "Update"}] ${received}Crew: ${remarks || "Arrived"}`;
    }
    // Only the first, and only when the column is empty.
    //
    // This was assigned on every stop, so a four-stop delivery ended up with the
    // last photograph and the three before it erased from the column. Nothing was
    // lost from storage and nothing is lost now - every proof is a POD row with a
    // dispatchID, a stop, a time and who recorded it, and both admin screens read
    // the rows rather than this.
    //
    // It is deliberately not turned into a list. A second copy of the same set
    // would be a second thing to keep in step, and the one that drifts is always
    // the copy. What the column is for now is the trips recorded before the rows
    // existed, which is why it is still read as a fallback - and writing the first
    // proof keeps that fallback pointing somewhere for a trip whose rows are
    // somehow missing.
    if (podPath && !current.pod_url) updatePayload.pod_url = podPath;
    if (status === DELIVERY_STATUS.completed) updatePayload.completedAt = new Date().toISOString();

    // The pickup leg used to be recorded only as current_step = 1, which is
    // an index into a list the browser built. Now it has a timestamp.
    if (pickupID !== null && !current.pickupCompletedAt) {
      updatePayload.pickupCompletedAt = new Date().toISOString();
    }

    // Conditional on the status we read, so two crew members submitting at
    // once cannot both apply their change.
    const { data: updated, error: updateErr } = await supabase
      .from("DispatchOrder")
      .update(updatePayload)
      .eq("dispatchID", dispatchID)
      .eq("status", current.status)
      .select("dispatchID")
      .maybeSingle();

    if (updateErr) throw new Error(`Database error: ${updateErr.message}`);
    if (!updated) {
      return NextResponse.json({ message: "This trip was updated by someone else. Please refresh." }, { status: 409 });
    }

    // Mark the stop that was just completed, so the admin dashboards and the
    // customer tracking page read progress from the itinerary rather than
    // from a step index. This used to require a proof-of-delivery photo to
    // have uploaded successfully, so a failed upload left the stop Pending
    // forever even though the trip had moved on.
    const completedAt = new Date().toISOString();

    // arrivedAt is no longer written here unless it is missing.
    //
    // It used to be set to completedAt on every stop, which made it a restatement
    // of the finish time rather than a record of the arrival - so "arrived" and
    // "delivered" were always the same instant and the time spent at a stop was
    // unknowable. The crew now report the arrival themselves, from
    // /api/crew/dispatches/arrive, and that is the timestamp worth keeping.
    //
    // The fallback stays for the stop that is finished without an arrival ever
    // having been reported: a crew who tapped straight through, or a trip that
    // was in flight when this shipped. Better a slightly late arrival time than a
    // null one.
    if (branchID !== null) {
      const { data: existing } = await supabase
        .from("BranchStops")
        .select("arrivedAt")
        .eq("branchID", branchID)
        .maybeSingle();

      const { error: stopErr } = await supabase
        .from("BranchStops")
        .update({
          stopStatus: STOP_STATUS.delivered,
          arrivedAt: (existing?.arrivedAt as string) ?? completedAt,
          completedAt,
        })
        .eq("branchID", branchID);
      if (stopErr) console.error("[Status API] Stop status update failed:", stopErr.message);
    }

    if (pickupID !== null) {
      const { data: existing } = await supabase
        .from("PickupStops")
        .select("arrivedAt")
        .eq("pickupID", pickupID)
        .maybeSingle();

      const { error: pickupErr } = await supabase
        .from("PickupStops")
        .update({
          stopStatus: STOP_STATUS.delivered,
          arrivedAt: (existing?.arrivedAt as string) ?? completedAt,
          completedAt,
        })
        .eq("pickupID", pickupID);
      if (pickupErr) console.error("[Status API] Pickup status update failed:", pickupErr.message);
    }

    // The proof of what happened at this stop.
    //
    // Three things were wrong with where this used to sit and what it wrote.
    //
    // It only wrote branchID. A pickup step sends pickupID and no branchID, so
    // every warehouse proof went in attached to nothing - the crew photographed
    // it, the file reached the bucket, and the record of it was unfindable. That
    // is why a one-pickup one-drop booking showed one proof instead of two.
    //
    // It left dispatchID, deliveredAt, recordedBy and fileType null. Those
    // columns were added for the coordinator path and this one was never brought
    // up to them, which is why the report showed proofs with no date beside them -
    // and why performanceService, which filters on deliveredAt, counted none of
    // them at all.
    //
    // And it only ran when there was a file. A stop finished without a photograph
    // left no row, so a report with nothing listed against a stop could mean "no
    // proof was taken" or "this stop was never reached", and the two look
    // identical. Now there is always a row, and an absent file says so in
    // missingReason - which the report already knows how to show.
    // POD stays one row per stop. Its photo columns are photo 1, so every
    // screen and count that reads them is unchanged; each photo, the first
    // included, is also a PODPhotos row with what its own scan found.
    const stopProof: Record<string, unknown> = {
      dispatchID,
      branchID,
      pickupID,
      proof: podPath,
      fileType: podFileType,
      receiverName: receiverName || "N/A",
      remarks: `[${title || "Location Update"}] ${remarks || "Uploaded via Crew App"}`,
      deliveredAt: completedAt,
      recordedBy: auth.employee.employeeID,
      source: "crew",
      missingReason: podPath ? null : "No photograph was taken at this stop",
      // Passed when every check ran and found nothing; anything it could not
      // check is the office's to look at.
      // The worst of the stop's photos: one unchecked page puts the stop in
      // front of the office.
      validationStatus: podPath && isStop ? (scanFlags.length === 0 ? "passed" : "unverified") : null,
      validationNotes: scanFlags.length > 0 ? scanFlags.join(" ") : null,
      scanMethod: scan?.method ?? (podPath && isStop ? "camera" : null),
      capturedAt: scan?.capturedAt || null,
      captureLat: scan?.latitude ?? null,
      captureLng: scan?.longitude ?? null,
      imageHash,
      imageDHash: scan?.dHash ?? null,
      docNumbers: scan?.docNumbers.length ? scan.docNumbers.join(" ") : null,
    };

    // Only for the real stops. The departure and return steps are not places
    // anything is handed over, and a proof row for them would be noise in a
    // record that is meant to be auditable.
    if (branchID !== null || pickupID !== null) {
      const { data: podRow, error: podInsertError } = await supabase
        .from("POD")
        .insert(stopProof)
        .select("podID")
        .single();
      if (podInsertError) {
        console.error("[Status API] POD Insert Error:", podInsertError.message);
      } else if (podRow && photos.length > 0) {
        const { error: photosInsertError } = await supabase.from("PODPhotos").insert(
          photos.map((photo, index) => ({
            podID: podRow.podID,
            position: index + 1,
            path: photo.path,
            fileType: photo.file.type || null,
            scanMethod: photo.scan?.method ?? (isStop ? "camera" : null),
            capturedAt: photo.scan?.capturedAt || null,
            captureLat: photo.scan?.latitude ?? null,
            captureLng: photo.scan?.longitude ?? null,
            imageHash: isStop ? photo.hash : null,
            imageDHash: photo.scan?.dHash ?? null,
            docNumbers: photo.scan?.docNumbers.length ? photo.scan.docNumbers.join(" ") : null,
            validationStatus: isStop ? (photo.flags.length === 0 ? "passed" : "unverified") : null,
            validationNotes: photo.flags.length > 0 ? photo.flags.join(" ") : null,
          })),
        );
        // Photo 1 is on the POD row whatever happens here, so the stop still
        // has its proof; the others are in the bucket under this trip's id.
        if (photosInsertError) {
          console.error(
            "[Status API] PODPhotos Insert Error:",
            photosInsertError.message,
            photos.map((photo) => photo.path),
          );
        }
      }
    }

    // A finished stop is one the truck is no longer driving to, so the route
    // held for this trip is out of date the moment it is recorded. Clearing it
    // here is exact; waiting for it to time out would leave the map pointing
    // at somewhere the truck has already been.
    forgetDispatchRoute(dispatchID);

    await recordAudit({
      table: "DispatchOrder",
      recordID: dispatchID,
      action: status === DELIVERY_STATUS.completed ? "TRIP_COMPLETE" : "TRIP_PROGRESS",
      actor: auditActor(auth),
      before: { status: current.status, current_step: currentStep },
      after: {
        status,
        current_step: nextStep,
        stop: pickupID !== null ? { pickupID } : branchID !== null ? { branchID } : null,
        proof: Boolean(podPath),
        proofPhotos: photos.length,
        proofCheckMode: podPath && isStop ? checkMode : null,
        proofCheck: podPath && isStop ? (scanFlags.length === 0 ? "passed" : "unverified") : null,
        proofFlags: scanFlags,
      },
    });

    // 5. Free the truck and crew once the trip is completed. The status is
    // already saved, so a failure here must not fail the request: it is
    // logged and retried if the crew app submits again.
    if (status === DELIVERY_STATUS.completed) {
      await releaseResources(dispatchID);
    }

    // Problems and the finish, and nothing in between.
    //
    // Every stop was announced for about an hour, which on a four-drop delivery
    // is six notifications nobody asked for. Ordinary progress belongs on the
    // fleet board, which recomputes it on every poll; the feed is for the things
    // somebody may have to do something about.
    //
    // A stop whose receipt was not fully checked is one of those: a name not
    // found on the paper, a form with no signature space the phone could find,
    // an app without the scanner. The stop went through so the truck was not
    // held at a gate, and the office can still act - the crew are near enough
    // to rescan, and a phone call now beats a gap found weeks later.
    if (isStop && podPath && scanFlags.length > 0) {
      await announceUnverifiedProof(
        dispatchID,
        (title || "a stop").replace(/^(Pickup|Dropoff):\s*/i, ""),
        scanFlags,
        completedAt,
        { employeeID: auth.employee.employeeID, employeeName: auth.employee.employeeName },
      );
    }

    if (status === DELIVERY_STATUS.completed) {
      await notify({
        event: "TRIP_COMPLETED",
        title: "Delivery completed",
        body: `${(await tripLabel(dispatchID)) ?? "A delivery"} was completed by ${auth.employee.employeeName}.`,
        severity: "info",
        roles: OFFICE,
        entity: { table: "DispatchOrder", id: dispatchID },
        link: "/admindashboard/feeds/completed",
        actor: { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
      });
    }

    return NextResponse.json({ message: "Status updated successfully", status, podUrl });
  } catch (error) {
    console.error("[Status API] CRITICAL ERROR:", error);
    return NextResponse.json({ message: "Failed to update status" }, { status: 500 });
  }
}
