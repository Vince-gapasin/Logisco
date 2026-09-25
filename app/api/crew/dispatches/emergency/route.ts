import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { DELIVERY_STATUS, TRUCK_STATUS } from "@/app/lib/enums";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { recordIncident } from "@/services/foulTrip/foulTripService";
import { notify, OFFICE, tripLabel } from "@/services/notifications/notify";
import { POD_BUCKET } from "@/services/storage/podService";
import {
  getCrewAssignment,
  isUuid,
  releaseDispatchResources,
  TERMINAL_DISPATCH_STATUSES,
} from "@/services/dispatch/dispatchService";

// Emergencies after which the truck must be inspected before its next trip.
const TRUCK_DAMAGE_ISSUES = ["Broken Truck", "Accident"];

// Two kinds of report come through here. A foul trip stops the delivery: the
// trip is marked, and its truck and crew are freed for other work. An issue
// is something the crew can carry on through - the wrong product collected, a
// receiver missing - and only needs recording and telling the office about.

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function coordinate(value: FormDataEntryValue | null, limit: number): number | null {
  const n = Number(value);
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

export async function POST(request: Request) {
  const { auth, response } = await authorize(request, CREW_ROLES);
  if (response) return response;

  try {
    const formData = await request.formData();
    const dispatchID = formData.get("dispatchID") as string | null;
    const issueType = ((formData.get("issueType") as string | null) || "").trim();
    const details = ((formData.get("details") as string | null) || "").trim();
    const photo = formData.get("emergencyImage");
    // Absent means a foul trip: that is what every existing client sends.
    const blocking = formData.get("canContinue") !== "yes";
    let latitude = coordinate(formData.get("latitude"), 90);
    let longitude = coordinate(formData.get("longitude"), 180);

    if (!isUuid(dispatchID) || !issueType) {
      return NextResponse.json({ message: "Missing required emergency details" }, { status: 400 });
    }
    // "Other" used to be sent with no description at all: the form had no box
    // for one. Dispatch cannot act on "Other".
    if (issueType === "Other" && !details) {
      return NextResponse.json({ message: "Describe what happened when choosing Other." }, { status: 400 });
    }

    const photoFile = photo instanceof File && photo.size > 0 ? photo : null;
    if (photoFile && !photoFile.type.startsWith("image/")) {
      return NextResponse.json({ message: "The photo must be an image." }, { status: 400 });
    }
    if (photoFile && photoFile.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ message: "The photo must be 10 MB or smaller." }, { status: 400 });
    }

    const assignment = await getCrewAssignment(dispatchID, auth.employee.employeeID);
    if (!assignment) {
      return NextResponse.json(
        { message: "Only the assigned driver or helper can report an emergency for this delivery." },
        { status: 403 },
      );
    }

    const current = assignment.dispatch;
    if (TERMINAL_DISPATCH_STATUSES.includes(current.status)) {
      return NextResponse.json({ message: `Dispatch is already ${current.status}.` }, { status: 409 });
    }

    // Where it happened. The phone sends its position; if it could not, the
    // truck's last reported fix is the best record - read now, because
    // releasing the trip below deletes it.
    if (latitude === null || longitude === null) {
      const { data: lastFix } = await supabase
        .from("FleetLocations")
        .select("latitude, longitude")
        .eq("dispatch_id", dispatchID)
        .maybeSingle();
      latitude = lastFix?.latitude ?? null;
      longitude = lastFix?.longitude ?? null;
    }

    // 1. Note it on the trip. A foul trip also changes its status, on the
    // status just read, so two crew members reporting at once cannot both
    // write; an issue leaves the delivery exactly as it was.
    const label = blocking ? "EMERGENCY" : "ISSUE";
    const reportNote = `${label} [${issueType}] reported by ${auth.employee.employeeName}: ${details || "No details provided"}`;
    const dispatchNote = current.dispatchNote ? `${current.dispatchNote}\n${reportNote}` : reportNote;

    const update = blocking
      ? { status: DELIVERY_STATUS.foulTrip, dispatchNote }
      : { dispatchNote };

    const { data: marked, error: updateErr } = await supabase
      .from("DispatchOrder")
      .update(update)
      .eq("dispatchID", dispatchID)
      .eq("status", current.status)
      .select("dispatchID")
      .maybeSingle();

    if (updateErr) throw new Error(`Failed to record the report: ${updateErr.message}`);
    if (!marked) {
      return NextResponse.json({ message: "This trip was updated by someone else. Please refresh." }, { status: 409 });
    }

    // 2. The photo. It used to be sent and then ignored - the server never
    // read it. Stored privately, like proofs of delivery.
    let photoPath: string | null = null;
    if (photoFile) {
      const safeName = photoFile.name.replace(/[^a-zA-Z0-9.]/g, "");
      const path = `incident-${dispatchID}-${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from(POD_BUCKET)
        .upload(path, await photoFile.arrayBuffer(), { contentType: photoFile.type });
      // A failed photo must not lose the report: the crew is in an emergency.
      if (uploadErr) console.error("[Emergency API] Photo upload failed:", uploadErr.message);
      else photoPath = path;
    }

    // 3. The incident: what, where, when, and where the trip stood.
    try {
      await recordIncident({
        dispatchID,
        orderID: current.orderID,
        truckID: current.truckID ?? null,
        reportedBy: auth.employee.employeeID,
        issueType,
        details: details || null,
        photoPath,
        latitude,
        longitude,
        dispatchStatusBefore: current.status,
        cargoLoaded: Boolean(current.pickupCompletedAt),
        blocking,
      });
    } catch (error) {
      console.error("[Emergency API] Incident not recorded:", error);
    }

    // 4. Kept for the reports screen, which reads it.
    const { error: reportErr } = await supabase.from("Reports").insert({
      dispatchID,
      status: DELIVERY_STATUS.foulTrip,
      finalRemarks: `${blocking ? "EMERGENCY ALERT" : "ISSUE REPORTED"}\nType: ${issueType}\nReported by: ${auth.employee.employeeName}\nDetails: ${details || "None provided"}`,
    });
    if (reportErr) console.error("[Emergency API] Report insert failed:", reportErr.message);

    // 5. A stopped trip frees its crew, and a damaged truck goes to
    // maintenance. A delivery still under way keeps both.
    if (blocking) {
      const truckStatus = TRUCK_DAMAGE_ISSUES.includes(issueType)
        ? TRUCK_STATUS.onMaintenance
        : TRUCK_STATUS.available;
      await releaseDispatchResources(dispatchID, truckStatus);
    }

    await recordAudit({
      table: "DispatchOrder",
      recordID: dispatchID,
      action: blocking ? "EMERGENCY" : "ISSUE",
      actor: auditActor(auth),
      before: { status: current.status },
      after: {
        status: blocking ? DELIVERY_STATUS.foulTrip : current.status,
        blocking,
        issueType,
        details: details || null,
        photo: Boolean(photoPath),
        located: latitude !== null && longitude !== null,
      },
    });

    await notify({
      event: blocking ? "FOUL_TRIP_REPORTED" : "DELIVERY_ISSUE_REPORTED",
      title: blocking ? `Foul trip: ${issueType}` : `Issue on a delivery: ${issueType}`,
      body: `${auth.employee.employeeName} reported ${issueType.toLowerCase()} on ${(await tripLabel(dispatchID)) ?? "a delivery"}.${details ? ` ${details}` : ""} ${blocking ? "It needs recovery." : "The delivery is carrying on."}`,
      severity: blocking ? "urgent" : "action",
      roles: OFFICE,
      entity: { table: "DispatchOrder", id: dispatchID },
      link: "/admindashboard/feeds/foul-trip",
      actor: { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
    });

    return NextResponse.json(
      {
        message: blocking
          ? "Emergency alert broadcasted successfully"
          : "Issue reported. Carry on with the delivery.",
        blocking,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Emergency API] CRITICAL ERROR:", error);
    return NextResponse.json({ message: "Failed to broadcast emergency" }, { status: 500 });
  }
}
