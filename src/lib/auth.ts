import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import type { Me } from "./perm";

export const SESSION_COOKIE = "ofr_session";
const SESSION_DAYS = 30;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(userId: string) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(s.sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(s.sessions).where(eq(s.sessions.id, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export const getMe = cache(async (): Promise<Me | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ user: s.users })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .where(and(eq(s.sessions.id, hashToken(token)), gt(s.sessions.expiresAt, new Date())));
  if (!row || !row.user.active) return null;
  const u = row.user;
  const memberships = await db
    .select({ subteamId: s.memberships.subteamId, role: s.memberships.role })
    .from(s.memberships)
    .where(eq(s.memberships.userId, u.id));
  if (!u.lastSeenAt || Date.now() - u.lastSeenAt.getTime() > 5 * 60e3)
    await db.update(s.users).set({ lastSeenAt: new Date() }).where(eq(s.users.id, u.id));
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: u.isAdmin,
    financeAccess: u.financeAccess,
    title: u.title,
    mustChangePassword: u.mustChangePassword,
    memberships,
  };
});

/** For pages: redirects to /login when signed out. */
export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.mustChangePassword) {
    const path = (await headers()).get("x-pathname") ?? "";
    if (!path.startsWith("/welcome")) redirect("/welcome");
  }
  return me;
}

/** For server actions: throws when signed out. */
export async function actor(): Promise<Me> {
  const me = await getMe();
  if (!me) throw new Error("Not signed in");
  return me;
}

export function deny(msg = "You don't have permission to do that."): never {
  throw new Error(msg);
}
