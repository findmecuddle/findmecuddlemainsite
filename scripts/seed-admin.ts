import "dotenv/config"; // tsx doesn't auto-load .env the way `next dev`/`next build` do.
import bcrypt from "bcryptjs";
import readline from "node:readline";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { admins } from "../src/lib/schema";

// Run with: npm run db:seed-admin
// Prompts for your name, email, and password right here in the terminal, so your real
// credentials never sit in plain text in this file (which is tracked by git). This creates
// (or updates the password of) your one "super" admin — the account that can add and remove
// other team members from the /admin/team page. Add everyone else from that page once you're
// logged in; you shouldn't need to run this script again after the first time.

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function main() {
  const name = (process.env.ADMIN_NAME || (await ask("Admin name: "))).trim();
  const email = (process.env.ADMIN_EMAIL || (await ask("Admin email: "))).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (await ask("Admin password (min 8 characters): "));

  if (!name || !email || !password) {
    console.error("Name, email, and password are all required.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, email)).limit(1);
  if (existing.length) {
    await db.update(admins).set({ passwordHash, name, role: "super" }).where(eq(admins.email, email));
    console.log(`\nUpdated existing super admin.`);
  } else {
    await db.insert(admins).values({ name, email, passwordHash, role: "super" });
    console.log(`\nCreated super admin.`);
  }

  console.log(`Log in at /admin/login with the email and password you just entered.`);
  console.log(`Add the rest of your team from the "Team" page in /admin once you're logged in.`);
  process.exit(0);
}

main();
