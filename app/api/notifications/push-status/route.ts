import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { pushDiagnosis, sendPush } from "@/services/notifications/pushService";

// Why a phone is silent.
//
// Push is best-effort by design - nothing it does may fail the booking that
// caused it - so a server with no Firebase credential behaves exactly like a
// working one and says nothing. This is the one place that answers plainly,
// from the deployment actually serving the request.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { auth, response } = await authorize(request, ["Admin"]);
  if (response) return response;
  void auth;

  const diagnosis = await pushDiagnosis();

  const { data: devices } = await supabase
    .from("DeviceToken")
    .select("employeeID, platform, lastSeenAt, failedAt, Employee ( employeeName, role )");

  return NextResponse.json(
    {
      data: {
        ...diagnosis,
        devices: (devices ?? []).map((device) => {
          const person = (Array.isArray(device.Employee) ? device.Employee[0] : device.Employee) as
            | { employeeName?: string; role?: string }
            | null;
          return {
            employeeID: device.employeeID,
            name: person?.employeeName ?? "Unknown",
            role: person?.role ?? "",
            platform: device.platform,
            lastSeenAt: device.lastSeenAt,
            // A phone Firebase has told us is gone: uninstalled, or its token replaced.
            dead: Boolean(device.failedAt),
          };
        }),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Sends a test notification to one person's phones, from this server. */
export async function POST(request: Request) {
  const { auth, response } = await authorize(request, ["Admin"]);
  if (response) return response;

  let body: { employeeID?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // No body: test this admin's own phones.
  }

  const employeeID = typeof body.employeeID === "string" ? body.employeeID : auth.employee.employeeID;

  const reached = await sendPush([employeeID], {
    title: "Logisco test",
    body: "Sent from the server. If this arrived, push is working.",
    link: "/",
    notificationID: `push-status-${Date.now()}`,
  });

  return NextResponse.json({
    data: {
      reached,
      message:
        reached > 0
          ? `Firebase accepted the message for ${reached} phone(s).`
          : "Nothing was sent: either that person has no phone registered, or this server cannot reach Firebase.",
    },
  });
}
