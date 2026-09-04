import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    
    // If requireAuth returns an error object, the token is dead
    if ("error" in auth) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }
    
    // If it passes, the token is perfectly valid
    return NextResponse.json({ valid: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: "Invalid session" }, { status: 401 });
  }
}