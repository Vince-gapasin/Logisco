import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ message: "Unauthorized request" }, { status: 401 });
    }

    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ message: "A valid new password is required (min 6 characters)" }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY; // The Master Key

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

    // 2. Initialize the Admin Client to bypass session requirements
    const adminClient = createClient(supabaseUrl, supabaseSecretKey);

    // 3. Update the user via the Admin API
    const { error } = await adminClient.auth.admin.updateUserById(user.id, { password: newPassword });

    if (error) throw error;

    return NextResponse.json({ message: "Password updated successfully!" }, { status: 200 });
  } catch (error: any) {
    console.error("Update password error:", error);
    return NextResponse.json({ message: error.message || "Failed to update password" }, { status: 500 });
  }
}