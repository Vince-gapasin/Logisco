import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth";
import { forgetDevice, registerDevice } from "@/services/notifications/pushService";

// The app hands over its push token after signing in, and gives it up on
// signing out so the next person on a shared phone is not sent their work.

export async function POST(request: Request) {
  const { auth, response } = await authorize(request);
  if (response) return response;

  let body: { token?: unknown; platform?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const platform = body.platform === "ios" || body.platform === "web" ? body.platform : "android";
  if (token.length < 10) return NextResponse.json({ message: "A device token is required" }, { status: 400 });

  try {
    await registerDevice(auth.employee.employeeID, token, platform);
    return NextResponse.json({ data: { registered: true } });
  } catch (error) {
    console.error("POST device token error:", error);
    return NextResponse.json({ message: "Failed to register this device" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { response } = await authorize(request);
  if (response) return response;

  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ message: "A device token is required" }, { status: 400 });

  try {
    await forgetDevice(token);
    return NextResponse.json({ data: { removed: true } });
  } catch (error) {
    console.error("DELETE device token error:", error);
    return NextResponse.json({ message: "Failed to remove this device" }, { status: 500 });
  }
}
