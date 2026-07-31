import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { admins, type Admin } from "./schema";

/**
 * Admin auth — separate from cuddler auth. Each team member has their own account in the
 * `admins` table (name, email, password, role). "super" admins can add/remove other admins from
 * the Team page; "staff" admins can moderate but not manage the team. Every mutating action taken
 * from /admin is logged to `admin_audit_log` with who/what/when — see admin/actions.ts.
 *
 * To create the very first admin account, run: npm run db:seed-admin
 * (edit scripts/seed-admin.ts first to set the name/email/password you want).
 */
const COOKIE = "admin_session";

// No fallback on purpose — see the matching comment in lib/auth.ts. A hardcoded fallback here
// would let anyone forge an admin session, which is worse than forging a cuddler one.
function secret() {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error(
      "AUTH_SECRET is not set (or too short). Generate one with `openssl rand -base64 32` and set it in .env."
    );
  }
  return new TextEncoder().encode(raw);
}

export async function hashAdminPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyAdminCredentials(email: string, password: string): Promise<Admin | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) return null;
  const rows = await db.select().from(admins).where(eq(admins.email, normalized)).limit(1);
  const admin = rows[0];
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.passwordHash);
  return ok ? admin : null;
}

export async function createAdminSession(adminId: string) {
  const token = await new SignJWT({ adminId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
}

export async function destroyAdminSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentAdmin(): Promise<Admin | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const adminId = typeof payload.adminId === "string" ? payload.adminId : null;
    if (!adminId) return null;
    const rows = await db.select().from(admins).where(eq(admins.id, adminId)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function isAdmin(): Promise<boolean> {
  return (await currentAdmin()) !== null;
}
