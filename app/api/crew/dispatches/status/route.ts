import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ message: "Server Configuration Error" }, { status: 500 });
  }

  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ message: "Invalid session" }, { status: 401 });

    // 1. Parse FormData
    const formData = await request.formData();
    const dispatchID = formData.get("dispatchID") as string;
    const status = formData.get("status") as string;
    const current_step = formData.get("current_step") as string;
    const remarks = formData.get("remarks") as string;
    const receiverName = formData.get("receiverName") as string;
    const file = formData.get("podImage") as File | null;

    if (!dispatchID || !status) {
      return NextResponse.json({ message: "Missing dispatchID or status" }, { status: 400 });
    }

    let podUrl = null;

    // 2. Upload file if it exists
    if (file) {
      const fileBuffer = await file.arrayBuffer();
      const fileName = `pod-${dispatchID}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;

      const { error: uploadErr } = await adminClient.storage
        .from("delivery_proofs")
        .upload(fileName, fileBuffer, {
          contentType: file.type,
        });

      if (uploadErr) {
        console.error("[Status API] Image Upload Error:", uploadErr);
        throw new Error("Failed to upload Proof of Delivery image");
      }

      const { data: { publicUrl } } = adminClient.storage
        .from("delivery_proofs")
        .getPublicUrl(fileName);

      podUrl = publicUrl;

      // 3. Insert directly into the POD Table
      if (receiverName) {
        const { error: podInsertError } = await adminClient
          .from("POD")
          .insert({
            proof: podUrl,
            receiverName: receiverName,
            remarks: remarks || "Uploaded via Crew App",
          });

        if (podInsertError) console.error("[Status API] POD Insert Error:", podInsertError);
      }
    }

    // 4. Update the DispatchOrder Database
    const updatePayload: any = { 
      status: status,
      current_step: parseInt(current_step) || 0 
    };
    if (remarks) updatePayload.dispatchNote = remarks;
    if (podUrl) updatePayload.pod_url = podUrl; 

    const { error: updateErr } = await adminClient
      .from("DispatchOrder")
      .update(updatePayload)
      .eq("dispatchID", dispatchID);

    if (updateErr) throw new Error(`Database error: ${updateErr.message}`);

    // 5. FREE UP RESOURCES IF TRIP IS COMPLETED
    if (status.toLowerCase() === "completed") {
      const { data: dispatchRecord } = await adminClient
        .from("DispatchOrder")
        .select(`truckID, driverID, DispatchHelper(helperID)`)
        .eq("dispatchID", dispatchID)
        .single();

      if (dispatchRecord) {
        if (dispatchRecord.truckID) {
          await adminClient.from("Truck").update({ truckStatus: "Available" }).eq("truckID", dispatchRecord.truckID);
        }
        if (dispatchRecord.driverID) {
          await adminClient.from("Employee").update({ availability: "Available" }).eq("employeeID", dispatchRecord.driverID);
        }
        if (dispatchRecord.DispatchHelper) {
          for (const helper of dispatchRecord.DispatchHelper) {
            if (helper.helperID) {
              await adminClient.from("Employee").update({ availability: "Available" }).eq("employeeID", helper.helperID);
            }
          }
        }
      }
    }

    return NextResponse.json({ message: "Status updated successfully", status, podUrl });
  } catch (error: any) {
    console.error("[Status API] CRITICAL ERROR:", error);
    return NextResponse.json({ message: error.message || "Failed to update status" }, { status: 500 });
  }
}