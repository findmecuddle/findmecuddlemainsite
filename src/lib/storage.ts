import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * S3-compatible object storage client — works unmodified with:
 *   - IONOS Object Storage (S3-compatible)
 *   - Cloudflare R2
 *   - AWS S3
 * Pick one, set the env vars below, done.
 *
 * Two buckets are used:
 *   - S3_BUCKET: public (ad photos, report evidence) — served straight from S3_PUBLIC_URL_BASE.
 *   - S3_PRIVATE_BUCKET: private (report evidence photos) — never public. Fetched server-side
 *     only, and only after an isAdmin() check (see /api/admin/report-evidence). Do NOT enable
 *     public access on this bucket.
 */
const CONNECTION_VARS = ["S3_ENDPOINT", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;

function assertConnectionConfigured() {
  const missing = CONNECTION_VARS.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Object storage isn't configured. Missing env vars: ${missing.join(", ")}. See .env.example.`);
  }
}

const globalForS3 = globalThis as unknown as { s3?: S3Client };

function client() {
  assertConnectionConfigured();
  if (!globalForS3.s3) {
    globalForS3.s3 = new S3Client({
      region: process.env.S3_REGION!,
      endpoint: process.env.S3_ENDPOINT!,
      // IONOS/R2 both use virtual-hosted or path-style depending on setup; path-style is the safe default.
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return globalForS3.s3;
}

// ---------- Public bucket (ad photos, report evidence) ----------

export async function uploadObject(key: string, body: Buffer, contentType: string): Promise<string> {
  if (!process.env.S3_BUCKET || !process.env.S3_PUBLIC_URL_BASE) {
    throw new Error("Public object storage isn't configured. Missing S3_BUCKET or S3_PUBLIC_URL_BASE. See .env.example.");
  }
  // No ACL param here on purpose — Cloudflare R2 doesn't support per-object ACLs (returns a hard
  // "501 Not Implemented" if you send one, unlike AWS S3 which just applies it). Public access is
  // controlled at the bucket level instead (R2's "Public Development URL" toggle, or a custom
  // domain) — see S3_PUBLIC_URL_BASE. If this project ever moves back to a provider that does use
  // per-object ACLs (plain AWS S3, some IONOS setups), the bucket's default/base ACL should be set
  // to public at the bucket level too, so this stays provider-agnostic either way.
  await client().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  const base = process.env.S3_PUBLIC_URL_BASE.replace(/\/$/, "");
  return `${base}/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  if (!process.env.S3_BUCKET) return;
  await client().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
}

/** Extracts the storage key back out of a public URL we generated, for deletes. */
export function keyFromPublicUrl(url: string): string | null {
  const base = (process.env.S3_PUBLIC_URL_BASE || "").replace(/\/$/, "");
  if (!base || !url.startsWith(base + "/")) return null;
  return url.slice(base.length + 1);
}

// ---------- Private bucket (license/ID verification documents) ----------

export async function uploadPrivateObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (!process.env.S3_PRIVATE_BUCKET) {
    throw new Error("Private document storage isn't configured. Missing S3_PRIVATE_BUCKET. See .env.example.");
  }
  await client().send(
    new PutObjectCommand({
      Bucket: process.env.S3_PRIVATE_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // No ACL — this bucket must never have public access enabled.
    })
  );
}

/** Fetches a private document server-side only. Returns null if missing/inaccessible — never throws to the caller. */
export async function getPrivateObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  if (!process.env.S3_PRIVATE_BUCKET) return null;
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: process.env.S3_PRIVATE_BUCKET, Key: key }));
    if (!res.Body) return null;
    const body = Buffer.from(await res.Body.transformToByteArray());
    return { body, contentType: res.ContentType || "image/jpeg" };
  } catch {
    return null;
  }
}

export async function deletePrivateObject(key: string): Promise<void> {
  if (!process.env.S3_PRIVATE_BUCKET) return;
  await client().send(new DeleteObjectCommand({ Bucket: process.env.S3_PRIVATE_BUCKET, Key: key }));
}
