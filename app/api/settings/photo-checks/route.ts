import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { auditActor } from "@/services/audit/auditService";
import {
  getPhotoCheckSettings,
  isPhotoCheckMode,
  PHOTO_CHECK_KEYS,
  setPhotoCheck,
  type PhotoCheckKey,
  type PhotoCheckMode,
} from "@/services/settings/photoCheckSettings";

// The photo-check switches.
//
//   GET  anyone signed in: the crew screen, the mechanic's form and the office
//        each need to know how their photos will be treated
//   PUT  the office (admin, coordinator): { podReceiptCheck?, repairPhotoCheck? },
//        each "strict" or "relaxed"
//
// The server decides either way: a screen with an old copy of a switch can at
// worst be stricter than it needs to be for one poll.

export async function GET(request: Request) {
  const { response } = await authorize(request);
  if (response) return response;

  const settings = await getPhotoCheckSettings();
  return NextResponse.json({ data: settings }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const { auth, response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const changes: [PhotoCheckKey, PhotoCheckMode][] = [];
  for (const key of PHOTO_CHECK_KEYS) {
    if (body[key] === undefined) continue;
    if (!isPhotoCheckMode(body[key])) {
      return NextResponse.json({ message: `${key} must be "strict" or "relaxed".` }, { status: 400 });
    }
    changes.push([key, body[key] as PhotoCheckMode]);
  }
  if (changes.length === 0) {
    return NextResponse.json({ message: "Nothing to change." }, { status: 400 });
  }

  try {
    for (const [key, mode] of changes) await setPhotoCheck(key, mode, auditActor(auth));
    return NextResponse.json({ data: await getPhotoCheckSettings() });
  } catch (error) {
    console.error("[Photo checks] Could not save:", error);
    return NextResponse.json({ message: "Could not save the photo check setting." }, { status: 500 });
  }
}
