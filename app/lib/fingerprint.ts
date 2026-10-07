import { createHash } from "node:crypto";

/**
 * A short, stable string standing for a value: two calls give the same answer
 * only if the value is the same. What the open screens compare every few
 * seconds to decide whether to fetch themselves again.
 *
 * The value is serialised as given, so a caller hashing rows must put them in
 * a fixed order first - the same rows in another order are another value.
 */
export function fingerprint(value: unknown): string {
  return createHash("sha1").update(JSON.stringify(value)).digest("base64url").slice(0, 16);
}
