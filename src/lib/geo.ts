// Location resolution without any external API.
// Uses the `zipcodes` package (bundled US zip database with lat/lng).
// Accepts: "90210" | "Los Angeles, CA" | "123 Main St, Austin, TX 78701" (zip is extracted)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const zipcodes = require("zipcodes");

export type GeoPoint = { lat: number; lng: number; label: string };

export function resolveLocation(qRaw: string): GeoPoint | null {
  const q = qRaw.trim();
  if (!q) return null;

  // 1) A 5-digit zip anywhere in the string (covers plain zips and full addresses)
  const zipMatch = q.match(/\b(\d{5})\b/);
  if (zipMatch) {
    const z = zipcodes.lookup(zipMatch[1]);
    if (z) return { lat: z.latitude, lng: z.longitude, label: `${z.city}, ${z.state} ${z.zip}` };
  }

  // 2) "City, ST" — take the last two comma parts so full addresses still work
  const parts = q.split(",").map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i > 0; i--) {
    const stateToken = parts[i].split(/\s+/)[0];
    const city = parts[i - 1].replace(/^\d+\s+/, ""); // strip leading street number
    const state = normalizeState(stateToken);
    if (!state) continue;
    const results = zipcodes.lookupByName(city, state);
    if (results && results.length) {
      const r = results[0];
      return { lat: r.latitude, lng: r.longitude, label: `${r.city}, ${r.state}` };
    }
  }

  // 3) Bare city name, no state — the library's lookupByName(city, state) crashes if state is
  // undefined (it unconditionally does state.toUpperCase() internally), so scan the bundled
  // zip database directly instead of calling it. First match wins — this is inherently a guess
  // (there are multiple "Austin"s, "Springfield"s, etc. across different states), which is fine
  // for a client casually searching but not precise enough for a cuddler registering their
  // actual business location — see resolveLocationStrict below for that case.
  if (parts.length === 1) {
    const cityLower = parts[0].toLowerCase();
    const match = (Object.values(zipcodes.codes) as { city: string; state: string; latitude: number; longitude: number }[])
      .find((z) => z.city.toLowerCase() === cityLower);
    if (match) return { lat: match.latitude, lng: match.longitude, label: `${match.city}, ${match.state}` };
  }

  return null;
}

/**
 * Same as resolveLocation, but only accepts a 5-digit zip or an explicit "City, ST" — never
 * guesses a bare city name against an arbitrary state. Use this anywhere a cuddler is setting
 * their own registered business location (signup, primary/second location), where placing them
 * in the wrong state silently would be a real problem, not just an inconvenience.
 */
export function resolveLocationStrict(qRaw: string): GeoPoint | null {
  const q = qRaw.trim();
  if (!q) return null;

  const zipMatch = q.match(/\b(\d{5})\b/);
  if (zipMatch) {
    const z = zipcodes.lookup(zipMatch[1]);
    if (z) return { lat: z.latitude, lng: z.longitude, label: `${z.city}, ${z.state} ${z.zip}` };
  }

  const parts = q.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const stateToken = parts[1].split(/\s+/)[0];
    const city = parts[0].replace(/^\d+\s+/, "");
    const state = normalizeState(stateToken);
    if (state) {
      const results = zipcodes.lookupByName(city, state);
      if (results && results.length) {
        const r = results[0];
        return { lat: r.latitude, lng: r.longitude, label: `${r.city}, ${r.state}` };
      }
    }
  }

  // No comma at all — try "City ST" (e.g. "Austin TX") by treating the last word as the state.
  // Still requires an explicit state; a single bare word (just "Austin") falls through to null.
  if (parts.length === 1) {
    const words = parts[0].split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      const state = normalizeState(words[words.length - 1]);
      const city = words.slice(0, -1).join(" ");
      if (state) {
        const results = zipcodes.lookupByName(city, state);
        if (results && results.length) {
          const r = results[0];
          return { lat: r.latitude, lng: r.longitude, label: `${r.city}, ${r.state}` };
        }
      }
    }
  }

  return null;
}

const STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

function normalizeState(token: string): string | null {
  const t = token.trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return STATE_NAMES[t.toLowerCase()] || null;
}

/** Great-circle distance in miles. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const toRad = (d: number) => (d * Math.PI) / 180;
