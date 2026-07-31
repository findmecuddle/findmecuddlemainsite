import { WEBSITE_URL_MAX_CHARS } from "./config";

/**
 * Validates and normalizes the cuddler "personal or business website" link (see the websiteUrl
 * comment in schema.ts). This is only ever rendered as a plain <a href> on the public page once an
 * admin approves it, but we still strictly require http(s) here regardless — anything else
 * (javascript:, data:, etc.) could otherwise execute in a visitor's browser when clicked.
 *
 * Returns `{ url: null }` for a blank input (clearing the field, not an error), `{ url: null, error }`
 * for something that doesn't look like a real http(s) address, or `{ url }` with the normalized,
 * absolute URL string on success.
 */
export function normalizeWebsiteUrl(raw: string): { url: string | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { url: null };
  if (trimmed.length > WEBSITE_URL_MAX_CHARS) {
    return { url: null, error: `Website link must be under ${WEBSITE_URL_MAX_CHARS} characters.` };
  }

  // Most people will just type "example.com" — auto-prepend https:// if no scheme was given.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { url: null, error: "Enter a valid website address, e.g. yourbusiness.com." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { url: null, error: "Website link must start with http:// or https://." };
  }
  if (!parsed.hostname.includes(".")) {
    return { url: null, error: "Enter a valid website address, e.g. yourbusiness.com." };
  }

  return { url: parsed.toString() };
}
