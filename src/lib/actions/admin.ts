"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getDb, schema as s } from "@/db";
import { actor, deny } from "@/lib/auth";
import { log } from "@/lib/log";
import { safe } from "@/lib/safe";

const done = () => revalidatePath("/", "layout");

async function admin() {
  const me = await actor();
  if (!me.isAdmin) deny("Admins only.");
  return me;
}

const tempPassword = () => randomBytes(9).toString("base64url");

const Memberships = z.array(z.object({ subteamId: z.string().uuid(), role: z.enum(["head", "cohead", "member"]) }));
const UserInput = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  title: z
    .string()
    .trim()
    .max(80)
    .nullish()
    .transform((v) => v || null),
  isAdmin: z.boolean(),
  financeAccess: z.boolean(),
  memberships: Memberships,
});

export async function createUser(input: z.input<typeof UserInput>) {
  return safe(async () => {
    const me = await admin();
    const v = UserInput.parse(input);
    const db = await getDb();
    const [exists] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, v.email));
    if (exists) deny("Someone with that email already exists.");
    const password = tempPassword();
    const [u] = await db
      .insert(s.users)
      .values({ name: v.name, email: v.email, title: v.title, isAdmin: v.isAdmin, financeAccess: v.financeAccess, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true })
      .returning();
    if (v.memberships.length) await db.insert(s.memberships).values(v.memberships.map((m) => ({ ...m, userId: u.id })));
    await log(db, me.id, "user", u.id, "created", { name: v.name, email: v.email });
    done();
    return { id: u.id, password };
  });
}

export async function updateUser(id: string, input: z.input<typeof UserInput>) {
  return safe(async () => {
    const me = await admin();
    const v = UserInput.parse(input);
    if (id === me.id && !v.isAdmin) deny("You can't remove your own admin access.");
    const db = await getDb();
    await db.update(s.users).set({ name: v.name, email: v.email, title: v.title, isAdmin: v.isAdmin, financeAccess: v.financeAccess }).where(eq(s.users.id, id));
    await db.delete(s.memberships).where(eq(s.memberships.userId, id));
    if (v.memberships.length) await db.insert(s.memberships).values(v.memberships.map((m) => ({ ...m, userId: id })));
    await log(db, me.id, "user", id, "updated", { memberships: v.memberships, isAdmin: v.isAdmin, financeAccess: v.financeAccess });
    done();
  });
}

export async function resetPassword(id: string) {
  return safe(async () => {
    const me = await admin();
    const db = await getDb();
    const password = tempPassword();
    await db.update(s.users).set({ passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true }).where(eq(s.users.id, id));
    await db.delete(s.sessions).where(eq(s.sessions.userId, id));
    await log(db, me.id, "user", id, "password_reset");
    return { password };
  });
}

export async function setActive(id: string, active: boolean) {
  return safe(async () => {
    const me = await admin();
    if (id === me.id) deny("You can't deactivate yourself.");
    const db = await getDb();
    await db.update(s.users).set({ active }).where(eq(s.users.id, id));
    if (!active) {
      await db.delete(s.sessions).where(eq(s.sessions.userId, id));
      await db.delete(s.timers).where(eq(s.timers.userId, id));
    }
    await log(db, me.id, "user", id, active ? "reactivated" : "deactivated");
    done();
  });
}

const TeamInput = z.object({
  name: z.string().trim().min(1).max(60),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,4}$/, "Code must be 2–4 letters"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z
    .string()
    .trim()
    .max(400)
    .nullish()
    .transform((v) => v || null),
});

export async function saveSubteam(id: string | null, input: z.input<typeof TeamInput>) {
  return safe(async () => {
    const me = await admin();
    const v = TeamInput.parse(input);
    const db = await getDb();
    if (id) await db.update(s.subteams).set(v).where(eq(s.subteams.id, id));
    else {
      const slug = v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const all = await db.select().from(s.subteams);
      await db.insert(s.subteams).values({ ...v, slug, sort: all.length + 1 });
    }
    await log(db, me.id, "subteam", id ?? me.id, id ? "updated" : "created", { name: v.name });
    done();
  });
}

const SettingsInput = z.object({
  teamName: z.string().trim().min(1).max(80),
  currency: z.string().trim().min(1).max(6),
  season: z.string().trim().min(1).max(20),
  seasonStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expenseCategories: z.array(z.string().trim().min(1)).min(1),
  incomeCategories: z.array(z.string().trim().min(1)).min(1),
  labels: z.array(z.string().trim().min(1)),
});

export async function saveSettings(input: z.input<typeof SettingsInput>) {
  return safe(async () => {
    const me = await admin();
    const v = SettingsInput.parse(input);
    const db = await getDb();
    for (const [key, value] of Object.entries(v))
      await db.insert(s.settings).values({ key, value }).onConflictDoUpdate({ target: s.settings.key, set: { value } });
    await log(db, me.id, "settings", me.id, "updated");
    done();
  });
}
