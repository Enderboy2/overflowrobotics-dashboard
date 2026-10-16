import "server-only";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { databaseUrl } from "./url";

export type DB = PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { __db?: DB; __dbPending?: Promise<DB> };

async function createLocal(): Promise<DB> {
  // Local development without a Postgres server: embedded Postgres (PGlite).
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // In-memory by default (re-seeded with demo data on every restart). Set PGLITE_DIR to persist.
  const dir = process.env.PGLITE_DIR;
  if (dir) (await import("node:fs")).mkdirSync(dir, { recursive: true });
  const client = dir ? new PGlite(dir) : new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  const { seed } = await import("./seed");
  await seed(db as unknown as DB, { demo: true });
  return db as unknown as DB;
}

function createRemote(): DB {
  const client = postgres(databaseUrl(), { max: 5, prepare: false });
  return drizzlePg(client, { schema });
}

export async function getDb(): Promise<DB> {
  if (g.__db) return g.__db;
  if (process.env.DATABASE_URL) {
    g.__db = createRemote();
    return g.__db;
  }
  g.__dbPending ??= createLocal().then(
    (db) => (g.__db = db),
    (e) => {
      g.__dbPending = undefined;
      throw e;
    },
  );
  return g.__dbPending;
}

export { schema };
