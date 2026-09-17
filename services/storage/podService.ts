// Proof-of-delivery photos.
//
// Uploads used to be handed out as getPublicUrl(), which is a permanent,
// unauthenticated link to the object. Those links were then stored in
// DispatchOrder.pod_url and POD.proof and shipped to the browser, so anyone
// who ever saw one - or who guessed a filename, since they are built from
// the dispatch id and a timestamp - could read a customer's signed delivery
// receipt forever, with no session and no role.
//
// What is stored now is the object path. A short-lived signed URL is minted
// when an authorised request actually asks for the photo. Rows written
// before this change still hold a full public URL, so the path is recovered
// from those too and they are re-signed the same way.

import { supabase } from "@/app/lib/supabase";

export const POD_BUCKET = "delivery_proofs";

// Long enough to open a booking, scroll through it, and print it.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Accepts either a stored path or a legacy public URL.
export function toPodObjectPath(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, "");
  }

  // .../storage/v1/object/public/delivery_proofs/<path>
  const marker = `/${POD_BUCKET}/`;
  const index = trimmed.indexOf(marker);
  if (index === -1) return null;

  const path = trimmed.slice(index + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

// One photo. Returns null rather than throwing: a missing proof must not
// take a booking screen down with it.
export async function signPodUrl(value: string | null | undefined): Promise<string | null> {
  const path = toPodObjectPath(value);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(POD_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error("[POD] Failed to sign proof URL:", error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}

// Several photos in one round trip, keyed by the value that was passed in so
// callers can map their rows back without knowing about paths.
export async function signPodUrls(
  values: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();

  const byPath = new Map<string, string[]>();
  for (const value of values) {
    const path = toPodObjectPath(value);
    if (!path || !value) continue;
    const existing = byPath.get(path);
    if (existing) existing.push(value);
    else byPath.set(path, [value]);
  }

  if (byPath.size === 0) return signed;

  const paths = [...byPath.keys()];
  const { data, error } = await supabase.storage
    .from(POD_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error("[POD] Failed to sign proof URLs:", error.message);
    return signed;
  }

  for (const entry of data ?? []) {
    if (!entry.signedUrl || !entry.path) continue;
    for (const original of byPath.get(entry.path) ?? []) {
      signed.set(original, entry.signedUrl);
    }
  }

  return signed;
}
