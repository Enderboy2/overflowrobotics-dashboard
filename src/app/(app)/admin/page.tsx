import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { requireMe } from "@/lib/auth";
import { getDb, schema as s } from "@/db";
import { getActivity } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { AdminClient } from "./client";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const me = await requireMe();
  if (!me.isAdmin) redirect("/");
  const db = await getDb();
  const [users, settings, activity] = await Promise.all([
    db
      .select({ id: s.users.id, name: s.users.name, email: s.users.email, title: s.users.title, isAdmin: s.users.isAdmin, financeAccess: s.users.financeAccess, active: s.users.active, lastSeenAt: s.users.lastSeenAt, mustChangePassword: s.users.mustChangePassword })
      .from(s.users)
      .orderBy(asc(s.users.name)),
    getSettings(),
    getActivity({ limit: 300 }),
  ]);
  return (
    <>
      <PageHeader title="Admin" />
      <AdminClient users={users.map((u) => ({ ...u, lastSeenAt: u.lastSeenAt?.toISOString() ?? null }))} settings={settings} activity={activity} />
    </>
  );
}
