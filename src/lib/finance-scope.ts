import "server-only";
import { isFinance, managedSubteams, type Me } from "./perm";

/** Which transactions a person may see: finance sees all; heads see their subteams' expenses. */
export function txVisible(me: Me) {
  if (isFinance(me)) return () => true;
  const mine = new Set(managedSubteams(me));
  return (t: { type: string; subteamId: string | null; paidBy: string | null }) => (t.type === "expense" && !!t.subteamId && mine.has(t.subteamId)) || t.paidBy === me.id;
}

export function requestVisible(me: Me) {
  if (isFinance(me)) return () => true;
  const mine = new Set(managedSubteams(me));
  return (r: { subteamId: string; requestedBy: string | null }) => mine.has(r.subteamId) || r.requestedBy === me.id;
}
