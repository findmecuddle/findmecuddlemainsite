// Photo screening for the "Flagged Photos" admin review queue — never used to auto-block an
// upload, only to queue a photo for a human to look at (see flaggedPhotos in schema.ts). Checks
// two separate things in one Sightengine request:
//   1. genai — is this photo AI-generated? (https://sightengine.com/docs/genai-image-detection)
//   2. nudity-2.1 — is this photo suggestive/revealing? (https://sightengine.com/docs/nudity-detection)
//
// Sign up for a free Sightengine account, grab the API user/secret from your dashboard, and set
// SIGHTENGINE_API_USER / SIGHTENGINE_API_SECRET in your env. If those aren't set, checkPhoto()
// just returns nulls — uploads work exactly as before, nothing is flagged, nothing breaks.

const SIGHTENGINE_URL = "https://api.sightengine.com/1.0/check.json";

export type PhotoScreenResult = {
  /** 0-1 confidence the image is AI-generated, or null if unavailable. */
  aiScore: number | null;
  /** 0-1 confidence the image is suggestive/revealing, or null if unavailable. */
  suggestiveScore: number | null;
};

type SightengineResponse = {
  type?: { ai_generated?: number };
  nudity?: {
    sexual_activity?: number;
    sexual_display?: number;
    erotica?: number;
    sextoy?: number;
    suggestive?: number;
  };
};

/** Runs both checks in a single API call. Deliberately fails open on any error or missing config —
 *  a detection-service outage or misconfiguration should never block or delay a legitimate photo
 *  upload; it just means nothing gets flagged for that photo. */
export async function checkPhoto(imageUrl: string): Promise<PhotoScreenResult> {
  const user = process.env.SIGHTENGINE_API_USER;
  const secret = process.env.SIGHTENGINE_API_SECRET;
  if (!user || !secret) return { aiScore: null, suggestiveScore: null };

  try {
    const params = new URLSearchParams({
      url: imageUrl,
      models: "genai,nudity-2.1",
      api_user: user,
      api_secret: secret,
    });
    const res = await fetch(`${SIGHTENGINE_URL}?${params.toString()}`, { method: "GET" });
    if (!res.ok) return { aiScore: null, suggestiveScore: null };

    const data = (await res.json()) as SightengineResponse;

    const aiScore = typeof data.type?.ai_generated === "number" ? data.type.ai_generated : null;

    // "Suggestive" here means the highest of any concerning category, not just the literal
    // "suggestive" field — a photo can score low on "suggestive" but high on "sexual_display", for
    // example, and either should count.
    const n = data.nudity;
    const suggestiveScore = n
      ? Math.max(n.sexual_activity ?? 0, n.sexual_display ?? 0, n.erotica ?? 0, n.sextoy ?? 0, n.suggestive ?? 0)
      : null;

    return { aiScore, suggestiveScore };
  } catch {
    return { aiScore: null, suggestiveScore: null };
  }
}
