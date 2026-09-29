import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { POD_BUCKET, signPodUrl } from "@/services/storage/podService";

// Correcting a proof of delivery.
//
// The two things that actually go wrong: a photograph taken in a moving truck
// that turns out to be unreadable, and a receiver's name typed one-handed at a
// gate. Neither is a reason to leave a delivery with no usable proof, and
// neither should be fixed by editing the database by hand.
//
// WHAT THIS DOES NOT DO
//
// It does not overwrite the old photograph. A proof of delivery is evidence, and
// a silent substitution of evidence is the thing nobody wants to explain later.
// The new file is uploaded under its own name, the row points at it, and the old
// object stays in the bucket. The change is written to the audit trail with both
// paths on it, so the Remarks History shows who replaced it and when - which
// means the substitution is part of the record rather than a gap in it.
//
// Office roles only. The crew record proofs; correcting one afterwards is an
// office decision and is attributed to the person who made it.

const MAX_POD_BYTES = 10 * 1024 * 1024;
const ALLOWED = /^(image\/|application\/pdf$)/i;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ podID: string }> },
) {
  const { auth, response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const { podID } = await params;
  if (!podID) {
    return NextResponse.json({ message: "Missing podID" }, { status: 400 });
  }

  try {
    const form = await request.formData();
    const file = form.get("proof") as File | null;
    const receiverName = (form.get("receiverName") as string | null)?.trim();
    const remarks = (form.get("remarks") as string | null)?.trim();
    const reason = (form.get("reason") as string | null)?.trim() ?? "";

    const { data: current, error: readError } = await supabase
      .from("POD")
      .select("podID, proof, fileType, receiverName, remarks, branchID, pickupID, dispatchID")
      .eq("podID", podID)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    if (!current) {
      return NextResponse.json({ message: "That proof no longer exists" }, { status: 404 });
    }

    const update: Record<string, unknown> = {};

    if (file && file.size > 0) {
      if (!ALLOWED.test(file.type)) {
        return NextResponse.json(
          { message: "A proof must be an image or a PDF" },
          { status: 400 },
        );
      }
      if (file.size > MAX_POD_BYTES) {
        return NextResponse.json(
          { message: "The file must be 10 MB or smaller" },
          { status: 400 },
        );
      }

      // Its own name, so nothing is overwritten and the previous object stays
      // exactly where it was.
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "");
      const fileName = `pod-edit-${podID}-${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(POD_BUCKET)
        .upload(fileName, await file.arrayBuffer(), { contentType: file.type });

      if (uploadError) {
        console.error("[POD PATCH] Upload failed:", uploadError.message);
        return NextResponse.json({ message: "Could not upload that file" }, { status: 502 });
      }

      update.proof = fileName;
      update.fileType = file.type;
      // A row that recorded why there was no photograph now has one.
      update.missingReason = null;
    }

    if (receiverName !== undefined && receiverName !== current.receiverName) {
      update.receiverName = receiverName || "N/A";
    }
    if (remarks !== undefined && remarks !== current.remarks) {
      update.remarks = remarks;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: "Nothing was changed" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("POD")
      .update(update)
      .eq("podID", podID);

    if (updateError) throw new Error(updateError.message);

    // Against the trip, so it lands in that booking's Remarks History beside
    // everything else that happened to it.
    await recordAudit({
      table: "DispatchOrder",
      recordID: current.dispatchID,
      action: "POD_EDIT",
      actor: auditActor(auth),
      before: {
        proof: current.proof,
        receiverName: current.receiverName,
        remarks: current.remarks,
      },
      after: {
        ...update,
        podID,
        reason,
        replacedPhoto: Boolean(update.proof),
        stop: current.branchID != null
          ? { branchID: current.branchID }
          : current.pickupID != null
            ? { pickupID: current.pickupID }
            : null,
      },
    });

    return NextResponse.json({
      success: true,
      proof: update.proof ? await signPodUrl(update.proof as string) : null,
    });
  } catch (error) {
    console.error("[POD PATCH Error]:", error);
    return NextResponse.json({ message: "Could not update that proof" }, { status: 500 });
  }
}
