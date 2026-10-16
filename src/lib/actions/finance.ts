"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/db";
import type { DB } from "@/db";
import { actor, deny } from "@/lib/auth";
import { isFinance, manages, type Me } from "@/lib/perm";
import { log, notify } from "@/lib/log";
import { safe } from "@/lib/safe";

const done = () => revalidatePath("/", "layout");
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optStr = z
  .string()
  .trim()
  .max(4000)
  .nullish()
  .transform((v) => v || null);
const optId = z
  .string()
  .uuid()
  .nullish()
  .or(z.literal(""))
  .transform((v) => v || null);

async function financeUsers(db: DB) {
  return (await db.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.active, true), eq(s.users.financeAccess, true)))).map((u) => u.id);
}
async function leadsOf(db: DB, subteamId: string) {
  return (await db.select().from(s.memberships).where(and(eq(s.memberships.subteamId, subteamId), ne(s.memberships.role, "member")))).map((m) => m.userId);
}

/* ───────── Receipts ───────── */

export async function uploadReceipt(form: FormData) {
  return safe(async () => {
    const me = await actor();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) deny("No file selected.");
    if (file.size > 5 * 1024 * 1024) deny("Receipts must be 5 MB or smaller.");
    const db = await getDb();
    const [f] = await db
      .insert(s.files)
      .values({ name: file.name, mime: file.type || "application/octet-stream", size: file.size, data: Buffer.from(await file.arrayBuffer()), uploadedBy: me.id })
      .returning({ id: s.files.id });
    return f.id;
  });
}

/* ───────── Transactions ───────── */

const TxInput = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive("Amount must be greater than zero"),
  date: DATE,
  description: z.string().trim().min(1, "Description is required").max(300),
  category: z.string().trim().min(1).max(80),
  vendor: optStr,
  method: optStr,
  subteamId: optId,
  projectId: optId,
  taskId: optId,
  sponsorId: optId,
  requestId: optId,
  paidBy: optId,
  reimbursement: z.enum(["none", "pending", "reimbursed"]),
  receiptId: optId,
  notes: optStr,
});

function canWriteTx(me: Me, v: { type: string; subteamId: string | null }) {
  if (isFinance(me)) return true;
  return v.type === "expense" && !!v.subteamId && manages(me, v.subteamId);
}

export async function saveTransaction(id: string | null, input: z.input<typeof TxInput>) {
  return safe(async () => {
    const me = await actor();
    const v = TxInput.parse(input);
    if (!canWriteTx(me, v)) deny("Only finance can record this. Heads can record expenses for their own subteam.");
    const db = await getDb();
    if (id) {
      const [old] = await db.select().from(s.transactions).where(eq(s.transactions.id, id));
      if (!old || !canWriteTx(me, old)) deny();
      await db.update(s.transactions).set(v).where(eq(s.transactions.id, id));
      await log(db, me.id, "transaction", id, "updated", { description: v.description, amount: v.amount });
    } else {
      const [t] = await db
        .insert(s.transactions)
        .values({ ...v, createdBy: me.id })
        .returning();
      await log(db, me.id, "transaction", t.id, "created", { description: v.description, amount: v.amount, type: v.type });
      if (v.paidBy && v.reimbursement === "pending")
        await notify(db, me.id, [v.paidBy], { title: `Reimbursement logged: ${v.description}`, href: "/finance/reimbursements" });
    }
    done();
  });
}

export async function deleteTransaction(id: string) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    const [t] = await db.select().from(s.transactions).where(eq(s.transactions.id, id));
    if (!t) return;
    if (!canWriteTx(me, t)) deny();
    await db.delete(s.transactions).where(eq(s.transactions.id, id));
    await log(db, me.id, "transaction", id, "deleted", { description: t.description, amount: t.amount });
    done();
  });
}

export async function setReimbursement(ids: string[], status: "pending" | "reimbursed" | "none") {
  return safe(async () => {
    const me = await actor();
    if (!isFinance(me)) deny();
    const db = await getDb();
    const rows = await db.select().from(s.transactions).where(inArray(s.transactions.id, ids));
    await db.update(s.transactions).set({ reimbursement: status }).where(inArray(s.transactions.id, ids));
    if (status === "reimbursed")
      for (const r of rows) await notify(db, me.id, [r.paidBy], { title: `You were reimbursed for ${r.description}`, href: "/finance/reimbursements" });
    done();
  });
}

/* ───────── Purchase requests ───────── */

const Item = z.object({ name: z.string().trim().min(1).max(200), qty: z.number().positive(), unitPrice: z.number().min(0), link: z.string().trim().max(500).optional() });
const RequestInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  justification: optStr,
  items: z.array(Item).min(1, "Add at least one item"),
  vendor: optStr,
  neededBy: DATE.nullish(),
  urgent: z.boolean(),
  subteamId: z.string().uuid(),
  projectId: optId,
  taskId: optId,
});

export async function saveRequest(id: string | null, input: z.input<typeof RequestInput>) {
  return safe(async () => {
    const me = await actor();
    const v = RequestInput.parse(input);
    const total = Math.round(v.items.reduce((a, i) => a + i.qty * i.unitPrice, 0) * 100) / 100;
    const db = await getDb();
    const inTeam = me.isAdmin || me.memberships.some((m) => m.subteamId === v.subteamId);
    if (!inTeam && !isFinance(me)) deny("You can only request purchases for your own subteam.");
    if (id) {
      const [r] = await db.select().from(s.purchaseRequests).where(eq(s.purchaseRequests.id, id));
      if (!r) deny("Request not found");
      const canEdit = (r.requestedBy === me.id && r.status === "pending") || isFinance(me) || manages(me, r.subteamId);
      if (!canEdit) deny("This request can no longer be edited.");
      await db
        .update(s.purchaseRequests)
        .set({ ...v, neededBy: v.neededBy ?? null, total, updatedAt: new Date() })
        .where(eq(s.purchaseRequests.id, id));
      await log(db, me.id, "request", id, "updated", { total });
      done();
      return { id, number: r.number };
    }
    // leads skip their own approval step
    const status = manages(me, v.subteamId) ? (isFinance(me) ? "approved" : "head_approved") : "pending";
    const [r] = await db
      .insert(s.purchaseRequests)
      .values({
        ...v,
        neededBy: v.neededBy ?? null,
        total,
        status,
        requestedBy: me.id,
        ...(status !== "pending" ? { headApprovedBy: me.id, headApprovedAt: new Date() } : {}),
        ...(status === "approved" ? { approvedBy: me.id, approvedAt: new Date() } : {}),
      })
      .returning();
    await log(db, me.id, "request", r.id, "created", { title: r.title, total });
    const href = `/finance/requests?r=${r.number}`;
    if (status === "pending") await notify(db, me.id, await leadsOf(db, v.subteamId), { title: `${me.name} requested a purchase`, body: `${r.title}`, href });
    if (status === "head_approved") await notify(db, me.id, await financeUsers(db), { title: `Purchase request awaiting finance`, body: r.title, href });
    done();
    return { id: r.id, number: r.number };
  });
}

export async function decideRequest(id: string, decision: "approve" | "reject", reason?: string) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    const [r] = await db.select().from(s.purchaseRequests).where(eq(s.purchaseRequests.id, id));
    if (!r) deny("Request not found");
    const href = `/finance/requests?r=${r.number}`;
    if (decision === "reject") {
      const allowed = (r.status === "pending" && manages(me, r.subteamId)) || (["pending", "head_approved", "approved"].includes(r.status) && isFinance(me));
      if (!allowed) deny();
      await db.update(s.purchaseRequests).set({ status: "rejected", rejectionReason: reason?.trim() || null, updatedAt: new Date() }).where(eq(s.purchaseRequests.id, id));
      await log(db, me.id, "request", id, "rejected", { reason });
      await notify(db, me.id, [r.requestedBy], { title: `Purchase request rejected: ${r.title}`, body: reason, href });
    } else if (r.status === "pending") {
      if (!manages(me, r.subteamId)) deny("Waiting for the subteam head or co-head.");
      const next = isFinance(me) ? "approved" : "head_approved";
      await db
        .update(s.purchaseRequests)
        .set({ status: next, headApprovedBy: me.id, headApprovedAt: new Date(), ...(next === "approved" ? { approvedBy: me.id, approvedAt: new Date() } : {}), updatedAt: new Date() })
        .where(eq(s.purchaseRequests.id, id));
      await log(db, me.id, "request", id, next);
      await notify(db, me.id, [r.requestedBy], { title: `${me.name} approved ${r.title}`, href });
      if (next === "head_approved") await notify(db, me.id, await financeUsers(db), { title: `Purchase request awaiting finance`, body: r.title, href });
    } else if (r.status === "head_approved") {
      if (!isFinance(me)) deny("Waiting for finance approval.");
      await db.update(s.purchaseRequests).set({ status: "approved", approvedBy: me.id, approvedAt: new Date(), updatedAt: new Date() }).where(eq(s.purchaseRequests.id, id));
      await log(db, me.id, "request", id, "approved");
      await notify(db, me.id, [r.requestedBy, r.headApprovedBy], { title: `Purchase approved: ${r.title}`, href });
    } else deny("Nothing to approve.");
    done();
  });
}

const OrderInput = z.object({
  amount: z.number().positive(),
  date: DATE,
  method: optStr,
  vendor: optStr,
  category: z.string().min(1),
  paidBy: optId,
  receiptId: optId,
});

/** Marks an approved request as ordered and books the expense. */
export async function orderRequest(id: string, input: z.input<typeof OrderInput>) {
  return safe(async () => {
    const me = await actor();
    const v = OrderInput.parse(input);
    const db = await getDb();
    const [r] = await db.select().from(s.purchaseRequests).where(eq(s.purchaseRequests.id, id));
    if (!r) deny("Request not found");
    if (r.status !== "approved") deny("Only approved requests can be marked as ordered.");
    if (!isFinance(me) && !manages(me, r.subteamId)) deny();
    await db.insert(s.transactions).values({
      type: "expense",
      amount: v.amount,
      date: v.date,
      description: r.title,
      category: v.category,
      vendor: v.vendor ?? r.vendor,
      method: v.method,
      subteamId: r.subteamId,
      projectId: r.projectId,
      taskId: r.taskId,
      requestId: r.id,
      paidBy: v.paidBy,
      reimbursement: v.paidBy ? "pending" : "none",
      receiptId: v.receiptId,
      createdBy: me.id,
      notes: `From purchase request PR-${r.number}`,
    });
    await db.update(s.purchaseRequests).set({ status: "ordered", updatedAt: new Date() }).where(eq(s.purchaseRequests.id, id));
    await log(db, me.id, "request", id, "ordered", { amount: v.amount });
    await notify(db, me.id, [r.requestedBy], { title: `Ordered: ${r.title}`, href: `/finance/requests?r=${r.number}` });
    done();
  });
}

export async function receiveRequest(id: string, addToInventory: boolean) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    const [r] = await db.select().from(s.purchaseRequests).where(eq(s.purchaseRequests.id, id));
    if (!r) deny("Request not found");
    if (r.status !== "ordered") deny("Only ordered requests can be marked as received.");
    if (!isFinance(me) && !manages(me, r.subteamId) && r.requestedBy !== me.id) deny();
    await db.update(s.purchaseRequests).set({ status: "received", updatedAt: new Date() }).where(eq(s.purchaseRequests.id, id));
    if (addToInventory)
      for (const it of r.items) {
        const [existing] = await db.select().from(s.inventory).where(and(eq(s.inventory.name, it.name), r.subteamId ? eq(s.inventory.subteamId, r.subteamId) : undefined));
        if (existing)
          await db
            .update(s.inventory)
            .set({ quantity: existing.quantity + Math.round(it.qty), unitCost: it.unitPrice, requestId: r.id, updatedAt: new Date() })
            .where(eq(s.inventory.id, existing.id));
        else
          await db.insert(s.inventory).values({ name: it.name, quantity: Math.round(it.qty), unitCost: it.unitPrice, subteamId: r.subteamId, requestId: r.id, unit: "pcs" });
      }
    await log(db, me.id, "request", id, "received", { addToInventory });
    await notify(db, me.id, [r.requestedBy], { title: `Received: ${r.title}`, href: `/finance/requests?r=${r.number}` });
    done();
  });
}

export async function cancelRequest(id: string) {
  return safe(async () => {
    const me = await actor();
    const db = await getDb();
    const [r] = await db.select().from(s.purchaseRequests).where(eq(s.purchaseRequests.id, id));
    if (!r) return;
    if (r.requestedBy !== me.id && !isFinance(me)) deny();
    if (["ordered", "received"].includes(r.status)) deny("This request was already ordered.");
    await db.update(s.purchaseRequests).set({ status: "cancelled", updatedAt: new Date() }).where(eq(s.purchaseRequests.id, id));
    await log(db, me.id, "request", id, "cancelled");
    done();
  });
}

/* ───────── Budgets ───────── */

export async function saveBudgets(season: string, rows: { subteamId: string | null; amount: number; notes?: string | null }[]) {
  return safe(async () => {
    const me = await actor();
    if (!isFinance(me)) deny();
    const db = await getDb();
    await db.delete(s.budgets).where(eq(s.budgets.season, season));
    const valid = rows.filter((r) => r.amount > 0);
    if (valid.length) await db.insert(s.budgets).values(valid.map((r) => ({ season, subteamId: r.subteamId, amount: r.amount, notes: r.notes ?? null })));
    await log(db, me.id, "budget", me.id, "updated", { season, total: valid.reduce((a, r) => a + r.amount, 0) });
    done();
  });
}

/* ───────── Sponsors ───────── */

const SponsorInput = z.object({
  name: z.string().trim().min(1).max(160),
  tier: optStr,
  status: z.enum(["prospect", "contacted", "negotiating", "committed", "active", "declined"]),
  contactName: optStr,
  contactEmail: optStr,
  contactPhone: optStr,
  pledged: z.number().min(0),
  inKind: optStr,
  ownerId: optId,
  nextFollowUp: DATE.nullish().or(z.literal("")).transform((v) => v || null),
  notes: optStr,
});

async function canSponsors(me: Me) {
  if (isFinance(me)) return true;
  const db = await getDb();
  const [media] = await db.select().from(s.subteams).where(eq(s.subteams.slug, "media"));
  return !!media && manages(me, media.id);
}

export async function saveSponsor(id: string | null, input: z.input<typeof SponsorInput>) {
  return safe(async () => {
    const me = await actor();
    if (!(await canSponsors(me))) deny("Only finance and media leads can manage sponsors.");
    const v = SponsorInput.parse(input);
    const db = await getDb();
    if (id) await db.update(s.sponsors).set(v).where(eq(s.sponsors.id, id));
    else {
      const [sp] = await db.insert(s.sponsors).values(v).returning();
      id = sp.id;
    }
    await log(db, me.id, "sponsor", id, "saved", { name: v.name, status: v.status });
    if (v.ownerId) await notify(db, me.id, [v.ownerId], { title: `You own the sponsor relationship with ${v.name}`, href: "/finance/sponsors" });
    done();
  });
}

export async function deleteSponsor(id: string) {
  return safe(async () => {
    const me = await actor();
    if (!isFinance(me)) deny();
    const db = await getDb();
    await db.delete(s.sponsors).where(eq(s.sponsors.id, id));
    done();
  });
}
