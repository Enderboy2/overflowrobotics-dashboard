import type { SubteamRole } from "@/db/schema";

export type Me = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  financeAccess: boolean;
  title: string | null;
  mustChangePassword: boolean;
  memberships: { subteamId: string; role: SubteamRole }[];
};

export const manages = (me: Me, subteamId: string | null | undefined) =>
  me.isAdmin || (!!subteamId && me.memberships.some((m) => m.subteamId === subteamId && m.role !== "member"));

export const isLead = (me: Me) => me.isAdmin || me.memberships.some((m) => m.role !== "member");

export const managedSubteams = (me: Me) => me.memberships.filter((m) => m.role !== "member").map((m) => m.subteamId);

export const canEditTask = (me: Me, t: { subteamId: string; createdBy: string | null }) =>
  manages(me, t.subteamId) || t.createdBy === me.id;

export const canWorkOnTask = (me: Me, t: { subteamId: string; createdBy: string | null }, assigneeIds: string[]) =>
  canEditTask(me, t) || assigneeIds.includes(me.id);

/** Full finance visibility (all subteams, income, sponsors). */
export const isFinance = (me: Me) => me.isAdmin || me.financeAccess;

/** Can see the finance section at all (heads see their subteam's slice). */
export const seesFinance = (me: Me) => isFinance(me) || isLead(me);
