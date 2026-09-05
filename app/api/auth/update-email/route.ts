import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ message: "Unauthorized request" }, { status: 401 });
    }

    const body = await request.json();
    const { newEmail } = body;

    if (!newEmail) {
      return NextResponse.json({ message: "New email is required" }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY; 

    if (!supabaseUrl || !supabaseAnonKey || !supabaseSecretKey) {
      return NextResponse.json({ message: "Supabase configuration variables are missing." }, { status: 500 });
    }

    // 1. Verify who the user is using their token
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    
    if (userErr || !user) {
      return NextResponse.json({ message: "Invalid or expired session" }, { status: 401 });
    }

    // 🚨 Store the old email before we change it in Auth
    const oldEmail = user.email;

    // 2. Initialize the Admin Client
    const adminClient = createClient(supabaseUrl, supabaseSecretKey);

    // 3. Update the user via the Admin API (Auth Dashboard)
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, { 
      email: newEmail,
      email_confirm: true 
    });

    if (updateError) throw updateError;

    // 4. Sync the new email to the Employee database table
    const { error: dbError } = await adminClient
      .from("Employee")
      .update({ emailAddress: newEmail }) 
      .eq("auth_id", user.id); // 🚨 Match using the auth_id column defined in your schema

    if (dbError) {
      console.warn("Auth updated, but failed to sync Employee table:", dbError);
      throw new Error("Failed to sync email to the database profile.");
    }

    return NextResponse.json(
      { message: "Email updated instantly and successfully synced to profile!" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Update email error:", error);
    return NextResponse.json({ message: error.message || "Failed to update email" }, { status: 500 });
  }
}