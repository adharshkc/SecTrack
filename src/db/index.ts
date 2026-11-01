import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDrizzleDb?: NodePgDatabase<typeof schema>;
};

export const pool: Pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString:
      databaseUrl || "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
    max: 10,
  });

if (process.env.NODE_ENV !== "production" && databaseUrl) {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db: NodePgDatabase<typeof schema> =
  globalForDb.__arenaNextJsDrizzleDb ?? drizzle(pool, { schema });

if (process.env.NODE_ENV !== "production" && databaseUrl) {
  globalForDb.__arenaNextJsDrizzleDb = db;
}

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
