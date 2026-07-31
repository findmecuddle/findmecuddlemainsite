import { randomBytes } from "crypto";

/** URL-safe unique id (no external deps). */
export function createId() {
  return randomBytes(12).toString("base64url");
}
