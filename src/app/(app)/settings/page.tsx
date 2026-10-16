import { eq } from "drizzle-orm";
import { requireMe } from "@/lib/auth";
import { getDb, schema as s } from "@/db";
import { PageHeader } from "@/components/ui";
import { SettingsClient } from "./client";

export const metadata = { title: "Settings" };

export default async function Page() {
  const me = await requireMe();
  const db = await getDb();
  const [u] = await db.select({ phone: s.users.phone }).from(s.users).where(eq(s.users.id, me.id));
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsClient phone={u?.phone ?? ""} />
    </>
  );
}
