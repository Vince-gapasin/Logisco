import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { STOP_STATUS } from "@/app/lib/stopStatus";
import {
  getCrewAssignment,
  isUuid,
  releaseDispatchResources,
  TERMINAL_DISPATCH_STATUSES,
} from "@/services/dispatch/dispatchService";

// Statuses the crew app may set, and the statuses each may be reached from.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  "In Transit": ["Assigned", "Accepted", "In Transit"],
  Completed: ["In Transit"],
};

const MAX_POD_BYTES = 10 * 1024 * 1024;

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
    const file = formData.get("podImage") as File | null;

    if (!isUuid(dispatchID) || !status) {
      return NextResponse.json({ message: "Missing or invalid dispatchID or status" }, { status: 400 });
    }

    if (!ALLOWED_TRANSITIONS[status]) {
      return NextResponse.json({ message: `Status "${status}" cannot be set from the crew app` }, { status: 400 });
    }

    // 2. Only the assigned driver or an accepted helper may update the trip.
    const assignment = await getCrewAssignment(dispatchID, auth.employee.employeeID);
    if (!assignment || (!assignment.isDriver && assignment.helper?.status !== "Accepted")) {
      return NextResponse.json({ message: "You are not assigned to this dispatch." }, { status: 403 });
    }

    const current = assignment.dispatch;
    const currentStep = current.current_step ?? 0;
    const parsedStep = stepValue !== null && stepValue !== "" ? parseInt(stepValue, 10) : NaN;
    const nextStep = Number.isNaN(parsedStep) ? currentStep : parsedStep;

    // A retried request (flaky mobile network) must not apply twice.
    if (current.status === status && nextStep <= currentStep) {
      // If releasing the truck and crew failed the first time, the retry is
      // the chance to finish the job; setting them free twice is harmless.
      if (status === "Completed") await releaseResources(dispatchID);

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

    // The stop being completed must belong to this dispatch's order.
    let branchID: number | null = null;
    if (branchIDValue) {
      const parsedBranch = parseInt(branchIDValue, 10);
      if (!Number.isNaN(parsedBranch)) {
        const { data: stop } = await supabase
          .from("BranchStops")
          .select("branchID")
          .eq("branchID", parsedBranch)
          .eq("orderID", current.orderID)
          .maybeSingle();
        branchID = stop?.branchID ?? null;
      }
    }

    let podUrl: string | null = null;

    // 3. Upload the proof-of-delivery photo, if any
    if (file && file.size > 0) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ message: "Proof of delivery must be an image" }, { status: 400 });
      }
      if (file.size > MAX_POD_BYTES) {
        return NextResponse.json({ message: "Proof of delivery image must be 10 MB or smaller" }, { status: 400 });
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "");
      const fileName = `pod-${dispatchID}-${Date.now()}-${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from("delivery_proofs")
        .upload(fileName, await file.arrayBuffer(), { contentType: file.type });

      if (uploadErr) {
        console.error("[Status API] Image Upload Error:", uploadErr);
        return NextResponse.json({ message: "Failed to upload Proof of Delivery image" }, { status: 502 });
      }

      podUrl = supabase.storage.from("delivery_proofs").getPublicUrl(fileName).data.publicUrl;

      const { error: podInsertError } = await supabase.from("POD").insert({
        branchID,
        proof: podUrl,
        receiverName: receiverName || "N/A",
        remarks: `[${title || "Location Update"}] ${remarks || "Uploaded via Crew App"}`,
      });

      if (podInsertError) console.error("[Status API] POD Insert Error:", podInsertError);
    }

    // 4. Update DispatchOrder, appending crew remarks to the existing notes
    const updatePayload: Record<string, unknown> = { status, current_step: nextStep };

    if (remarks || podUrl) {
      const received = receiverName ? `Received by ${receiverName}. ` : "";
      updatePayload.dispatchNote =
        `${current.dispatchNote || ""}\n[${title || "Update"}] ${received}Crew: ${remarks || "Arrived"}`;
    }
    if (podUrl) updatePayload.pod_url = podUrl;
    if (status === "Completed") updatePayload.completedAt = new Date().toISOString();

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

    // Mark the delivered stop so the admin dashboards see the progress.
    if (branchID !== null && podUrl) {
      const { error: stopErr } = await supabase
        .from("BranchStops")
        .update({ stopStatus: STOP_STATUS.delivered })
        .eq("branchID", branchID);
      if (stopErr) console.error("[Status API] Stop status update failed:", stopErr.message);
    }

    // 5. Free the truck and crew once the trip is completed. The status is
    // already saved, so a failure here must not fail the request: it is
    // logged and retried if the crew app submits again.
    if (status === "Completed") {
      await releaseResources(dispatchID);
    }

    return NextResponse.json({ message: "Status updated successfully", status, podUrl });
  } catch (error) {
    console.error("[Status API] CRITICAL ERROR:", error);
    return NextResponse.json({ message: "Failed to update status" }, { status: 500 });
  }
}
