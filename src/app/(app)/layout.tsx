import { and, count, eq, isNull } from "drizzle-orm";
import { requireMe } from "@/lib/auth";
import { getDirectory, getRunningTimer } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { getDb, schema as s } from "@/db";
import { AppProvider } from "@/components/app-context";
import { Shell } from "@/components/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  const db = await getDb();
  const [dir, settings, timer, [{ unread }]] = await Promise.all([
    getDirectory(),
    getSettings(),
    getRunningTimer(me.id),
    db
      .select({ unread: count() })
      .from(s.notifications)
      .where(and(eq(s.notifications.userId, me.id), isNull(s.notifications.readAt))),
  ]);
  return (
    <AppProvider me={me} dir={dir} settings={settings}>
      <Shell unread={unread} timer={timer}>
        {children}
      </Shell>
    </AppProvider>
  );
}
