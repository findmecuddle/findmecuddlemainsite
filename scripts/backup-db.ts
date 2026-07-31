import "dotenv/config"; // tsx doesn't auto-load .env the way `next dev`/`next build` do — without
// this, DATABASE_URL/S3_PRIVATE_BUCKET/etc. are all undefined when this script runs standalone.
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, readFileSync } from "fs";
import path from "path";
import { uploadPrivateObject } from "../src/lib/storage";

// Run with: npm run db:backup
// Meant to be scheduled (e.g. a daily crontab entry) once this app is deployed — see NEXT_STEPS.md.
//
// Why this exists: GitHub only ever holds code — the database (cuddlers, reviews, admins,
// newsletter subscribers, everything) is gitignored on purpose and never touches GitHub at all,
// so nothing that happens in the repo (a bad push, a force-push, even deleting the repo) can ever
// lose a single row of real customer data. The actual risk is losing the SERVER: a bad migration,
// a full disk, a fat-fingered `rm`, or the VPS itself dying. This script protects against that by
// taking a safe, consistent snapshot of the live database and storing copies in two places:
//   1. Locally in ./backups, rotated to keep the last LOCAL_RETENTION_DAYS days — fast, free,
//      good for "I broke something 10 minutes ago."
//   2. Uploaded to the private object storage bucket (same one license/ID photos live in, which
//      is already off-server and never public) under db-backups/ — survives even if the whole
//      server is lost.
//
// Uses better-sqlite3's native .backup() API rather than just copying the file, which matters:
// a plain file copy taken while the app is writing to the database can capture it mid-write and
// be corrupt. .backup() uses SQLite's own backup API and is safe to run on a live database.

const LOCAL_RETENTION_DAYS = 14;

async function main() {
  const dbFile = (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, "");
  if (!existsSync(dbFile)) {
    console.error(`Database file not found at ${dbFile}. Check DATABASE_URL.`);
    process.exit(1);
  }

  const backupDir = path.join(process.cwd(), "backups");
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const localPath = path.join(backupDir, `backup-${stamp}.db`);

  console.log(`Backing up ${dbFile} -> ${localPath} ...`);
  const source = new Database(dbFile, { readonly: true });
  await source.backup(localPath);
  source.close();
  console.log("Local backup written.");

  // Best-effort upload to off-server storage — a missing/misconfigured bucket shouldn't stop the
  // local backup (which already succeeded) from counting as a success.
  try {
    const body = readFileSync(localPath);
    await uploadPrivateObject(`db-backups/backup-${stamp}.db`, body, "application/octet-stream");
    console.log("Uploaded to private object storage (db-backups/).");
  } catch (err) {
    console.error("Warning: local backup succeeded, but upload to object storage failed:", err instanceof Error ? err.message : err);
  }

  // Rotate old local backups.
  const cutoff = Date.now() - LOCAL_RETENTION_DAYS * 86_400_000;
  const files = readdirSync(backupDir).filter((f) => f.startsWith("backup-") && f.endsWith(".db"));
  let removed = 0;
  for (const f of files) {
    const full = path.join(backupDir, f);
    if (statSync(full).mtimeMs < cutoff) {
      unlinkSync(full);
      removed++;
    }
  }
  if (removed) console.log(`Removed ${removed} local backup(s) older than ${LOCAL_RETENTION_DAYS} days.`);

  console.log("Backup complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
