import { requireMe } from "@/lib/auth";
import { getDb, schema as s } from "@/db";
import { getRequests } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { requestVisible } from "@/lib/finance-scope";
import { RequestsClient } from "./client";

export const metadata = { title: "Purchase requests" };

export default async function Page() {
  const me = await requireMe();
  const db = await getDb();
  const [requests, settings, tasks] = await Promise.all([
    getRequests(),
    getSettings(),
    db.select({ id: s.tasks.id, number: s.tasks.number, title: s.tasks.title, subteamId: s.tasks.subteamId }).from(s.tasks),
  ]);
  return <RequestsClient rows={requests.filter(requestVisible(me))} settings={settings} tasks={tasks} />;
}
