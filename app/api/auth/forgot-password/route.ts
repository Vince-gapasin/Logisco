import { NextResponse } from "next/server";

import { supabaseAuth } from "@/app/lib/supabaseAuth";

/*
  Sends the "forgot password" email from the server.

  The browser Supabase client uses the PKCE flow, whose emailed link only
  works in the same browser that asked for it. Sending it from here (implicit
  flow) puts the session tokens in the link itself, so it opens on any device
  - including a phone - and lands on /reset-password, not the activation page.
*/
export async function POST(request: Request) {
  let email = "";

  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim() : "";
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { message: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;

  const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  if (error) {
    // Logged, but the reply stays the same either way so this endpoint
    // cannot be used to find out which emails have accounts.
    console.error("Forgot password email error:", error.message);

    if (error.status === 429) {
      return NextResponse.json(
        { message: "Too many reset requests. Please wait a few minutes and try again." },
        { status: 429 },
      );
    }
  }

  return NextResponse.json(
    { message: "If an account matches this email, a password reset link has been sent." },
    { status: 200 },
  );
}
