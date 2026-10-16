import { asc } from "drizzle-orm";
import { requireMe } from "@/lib/auth";
import { getDb, schema as s } from "@/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { InventoryClient } from "./client";

export const metadata = { title: "Inventory" };

export default async function Page() {
  await requireMe();
  const db = await getDb();
  const [items, settings] = await Promise.all([db.select().from(s.inventory).orderBy(asc(s.inventory.name)), getSettings()]);
  return (
    <>
      <PageHeader title="Inventory" />
      <InventoryClient items={items.map((i) => ({ ...i, updatedAt: i.updatedAt.toISOString() }))} currency={settings.currency} />
    </>
  );
}
