import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof makeDb> };

function makeDb() {
  const file = (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, "");
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export const db = globalForDb.db ?? makeDb();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
