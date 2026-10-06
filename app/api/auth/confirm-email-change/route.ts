import { supabase } from "@/app/lib/supabase";
import { readEmailChangeToken } from "@/app/lib/emailChangeToken";
import { auditActor, recordAudit } from "@/services/audit/auditService";

// Opened from the link in the new address's inbox.
//
// No session and no password: reading the link is what is being proved, and the
// person opening it is on whatever device their mail is on. The token is the
// whole credential, which is why it is signed, short-lived, and pinned to the
// address the request was made from.
//
// It answers with a page rather than JSON. The reader is a person who clicked a
// link in an email, not a script.

export const dynamic = "force-dynamic";

// The address comes out of the token, so it is signed - but it is still text
// someone typed, and this is HTML. Escaped rather than trusted.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function page(title: string, body: string, tone: "ok" | "bad"): Response {
  const accent = tone === "ok" ? "#15803d" : "#b91c1c";

  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${title} · Logisco</title></head>` +
      `<body style="margin:0;background:#f2f4f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a">` +
      `<div style="max-width:28rem;margin:12vh auto;padding:0 20px">` +
      `<div style="background:#fff;border:1px solid #d8dde8;border-radius:12px;padding:28px">` +
      `<h1 style="margin:0 0 10px;font-size:20px;color:${accent}">${title}</h1>` +
      `<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#334155">${body}</p>` +
      `<a href="/login" style="display:inline-block;background:#1b4fa8;color:#fff;text-decoration:none;` +
      `padding:10px 18px;border-radius:8px;font-weight:bold;font-size:14px">Go to sign in</a>` +
      `</div></div></body></html>`,
    { status: tone === "ok" ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";

  const check = readEmailChangeToken(token);
  if (!check.ok) {
    return page(
      check.reason === "expired" ? "This link has expired" : "This link is not valid",
      check.reason === "expired"
        ? "Confirmation links last thirty minutes. Nothing has changed - sign in and ask again."
        : "Nothing has changed. If you asked to change your sign-in address, request it again from your profile.",
      "bad",
    );
  }

  const { employeeID, newEmail, fromEmail } = check.claim;

  try {
    const { data: employee, error } = await supabase
      .from("Employee")
      .select("employeeID, employeeName, emailAddress, auth_id")
      .eq("employeeID", employeeID)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!employee?.auth_id) {
      return page("This link is not valid", "That account could not be found.", "bad");
    }

    // The address has moved since this link was made - a later change, or this
    // link opened twice. Either way it is no longer the change being asked for.
    if ((employee.emailAddress ?? "").toLowerCase() !== fromEmail.toLowerCase()) {
      const alreadyDone = (employee.emailAddress ?? "").toLowerCase() === newEmail.toLowerCase();
      return alreadyDone
        ? page("Already confirmed", `You sign in with ${escapeHtml(newEmail)}.`, "ok")
        : page(
            "This link is out of date",
            "The sign-in address has changed since this link was sent, so it no longer applies.",
            "bad",
          );
    }

    // Confirmed here rather than by Supabase, because opening this link is the
    // proof it would otherwise ask for.
    const { error: authError } = await supabase.auth.admin.updateUserById(employee.auth_id, {
      email: newEmail,
      email_confirm: true,
    });

    if (authError) {
      const alreadyUsed = /already (been )?registered|already exists/i.test(authError.message);
      return page(
        alreadyUsed ? "That address is already in use" : "Something went wrong",
        alreadyUsed
          ? "Another account already signs in with that address, so this one cannot."
          : "Your sign-in address was not changed. Try requesting it again.",
        "bad",
      );
    }

    // The profile follows the login. If this fails the two are out of step, and
    // the next sign-in puts them back - login reconciles the Employee row
    // against the address the account actually authenticated with.
    const { error: dbError } = await supabase
      .from("Employee")
      .update({ emailAddress: newEmail })
      .eq("employeeID", employeeID);

    if (dbError) console.error("[Email change] Profile not synced:", dbError.message);

    await recordAudit({
      table: "Employee",
      recordID: employeeID,
      action: "EMAIL_CHANGE_CONFIRMED",
      actor: auditActor({ employee: { employeeID, employeeName: employee.employeeName } }),
      before: { emailAddress: fromEmail },
      after: { emailAddress: newEmail, confirmed: true },
    });

    return page(
      "Address confirmed",
      `You now sign in with ${escapeHtml(newEmail)}. Your password has not changed.`,
      "ok",
    );
  } catch (error) {
    console.error("Confirm email change error:", error);
    return page(
      "Something went wrong",
      "Your sign-in address was not changed. Try requesting it again from your profile.",
      "bad",
    );
  }
}
