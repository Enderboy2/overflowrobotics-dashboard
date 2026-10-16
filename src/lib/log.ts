import "server-only";
import type { DB } from "@/db";
import { schema as s } from "@/db";

export async function log(db: DB, actorId: string, entity: string, entityId: string, action: string, detail?: Record<string, unknown>) {
  await db.insert(s.activity).values({ actorId, entity, entityId, action, detail });
}

export async function notify(
  db: DB,
  actorId: string,
  userIds: (string | null | undefined)[],
  n: { title: string; body?: string; href?: string },
) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x && x !== actorId))];
  if (!ids.length) return;
  await db.insert(s.notifications).values(ids.map((userId) => ({ userId, actorId, ...n })));
}
