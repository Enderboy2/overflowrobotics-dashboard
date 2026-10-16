import "server-only";
import { cache } from "react";
import { getDb, schema as s } from "@/db";
import { DEFAULT_SETTINGS } from "@/db/seed";

export type Settings = typeof DEFAULT_SETTINGS;

export const getSettings = cache(async (): Promise<Settings> => {
  const db = await getDb();
  const rows = await db.select().from(s.settings);
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const r of rows) out[r.key] = r.value;
  return out as Settings;
});
