/**
 * Applies migrations and seeds required data (subteams, settings, first admin)
 * against DATABASE_URL. Runs automatically before every production build.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed";
import { databaseUrl } from "../src/db/url";
import type { DB } from "../src/db/index";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL not set — skipping migrations (local dev uses embedded Postgres).");
    return;
  }
  const client = postgres(databaseUrl(url), { max: 1, prepare: false });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seed(db as unknown as DB, { demo: false });
  await client.end();
  console.log("Database ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
