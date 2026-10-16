"use client";

import * as React from "react";
import { Paperclip, Plus, Trash2, X } from "lucide-react";
import { useApp, type Settings } from "./app-context";
import { Button, Dialog, Field, IconButton, Select, Toggle, useAction, useToast } from "./ui";
import { deleteSponsor, deleteTransaction, orderRequest, saveRequest, saveSponsor, saveTransaction, uploadReceipt } from "@/lib/actions/finance";
import { SPONSOR_STATUSES } from "@/lib/meta";
import { isFinance, managedSubteams } from "@/lib/perm";
import { money, todayISO } from "@/lib/utils";
import type { RequestItem, SponsorStatus } from "@/db/schema";

export type Tx = {
  id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  description: string;
  category: string;
  vendor: string | null;
  method: string | null;
  subteamId: string | null;
  projectId: string | null;
  taskId: string | null;
  sponsorId: string | null;
  requestId: string | null;
  paidBy: string | null;
  reimbursement: "none" | "pending" | "reimbursed";
  receiptId: string | null;
  notes: string | null;
  createdAt: string;
};

export const METHODS = ["Cash", "Bank transfer", "InstaPay", "Card", "Vodafone Cash", "Cheque", "Other"];

export function ReceiptField({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const toast = useToast();
  const ref = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <>
          <a href={`/api/files/${value}`} target="_blank" className="flex items-center gap-1.5 text-[13px] text-info hover:underline">
            <Paperclip className="size-3.5" />
            View receipt
          </a>
          <IconButton label="Remove receipt" onClick={() => onChange(null)} className="size-6">
            <X />
          </IconButton>
        </>
      ) : (
        <Button type="button" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
          <Paperclip />
          {busy ? "Uploading…" : "Attach receipt"}
        </Button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          const fd = new FormData();
          fd.set("file", f);
          const r = await uploadReceipt(fd);
          setBusy(false);
          e.target.value = "";
          if (r.ok) onChange(r.data);
          else toast(r.error, "error");
        }}
      />
    </div>
  );
}

export function TxDialog({
  tx,
  settings,
  sponsors,
  tasks,
  onClose,
}: {
  tx?: Tx;
  settings: Settings;
  sponsors: { id: string; name: string }[];
  tasks: { id: string; number: number; title: string; subteamId: string }[];
  onClose: () => void;
}) {
  const { me, dir, activePeople, taskKey } = useApp();
  const { run, pending } = useAction();
  const fin = isFinance(me);
  const myTeams = managedSubteams(me);
  const canEdit = !tx || fin || (tx.type === "expense" && !!tx.subteamId && myTeams.includes(tx.subteamId));
  const [f, setF] = React.useState(() => ({
    type: tx?.type ?? ("expense" as "income" | "expense"),
    amount: tx?.amount?.toString() ?? "",
    date: tx?.date ?? todayISO(),
    description: tx?.description ?? "",
    category: tx?.category ?? settings.expenseCategories[0],
    vendor: tx?.vendor ?? "",
    method: tx?.method ?? "",
    subteamId: tx?.subteamId ?? (fin ? "" : (myTeams[0] ?? "")),
    projectId: tx?.projectId ?? "",
    taskId: tx?.taskId ?? "",
    sponsorId: tx?.sponsorId ?? "",
    requestId: tx?.requestId ?? null,
    paidBy: tx?.paidBy ?? "",
    reimbursement: tx?.reimbursement ?? ("none" as Tx["reimbursement"]),
    receiptId: tx?.receiptId ?? null,
    notes: tx?.notes ?? "",
  }));
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const cats = f.type === "income" ? settings.incomeCategories : settings.expenseCategories;
  const teamTasks = tasks.filter((t) => !f.subteamId || t.subteamId === f.subteamId);
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={tx ? (canEdit ? "Edit transaction" : tx.description) : "Add transaction"}
      wide
      footer={
        canEdit ? (
          <>
            {tx && (
              <Button variant="danger" className="mr-auto" onClick={() => confirm("Delete this transaction?") && run(() => deleteTransaction(tx.id), { then: onClose, success: "Deleted" })}>
                Delete
              </Button>
            )}
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    saveTransaction(tx?.id ?? null, {
                      ...f,
                      amount: Number(f.amount),
                      reimbursement: f.paidBy ? (f.reimbursement === "none" ? "pending" : f.reimbursement) : "none",
                    }),
                  { success: "Saved", then: (r) => r.ok && onClose() },
                )
              }
            >
              Save
            </Button>
          </>
        ) : undefined
      }
    >
      <fieldset disabled={!canEdit} className="grid gap-3 pb-2 sm:grid-cols-2">
        {fin && (
          <div className="flex rounded-md border border-line bg-surface p-0.5 sm:col-span-2">
            {(["expense", "income"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => set({ type: t, category: (t === "income" ? settings.incomeCategories : settings.expenseCategories)[0] })}
                className={`h-7 flex-1 rounded text-[13px] ${f.type === t ? "bg-surface-3 font-medium" : "text-muted"}`}
              >
                {t === "expense" ? "Expense" : "Income"}
              </button>
            ))}
          </div>
        )}
        <Field label="Description" className="sm:col-span-2">
          <input autoFocus value={f.description} onChange={(e) => set({ description: e.target.value })} className="input" placeholder={f.type === "income" ? "e.g. Sponsor payment, Q1" : "e.g. 20x20 aluminum extrusions"} />
        </Field>
        <Field label={`Amount (${settings.currency})`}>
          <input type="number" min={0} step="0.01" value={f.amount} onChange={(e) => set({ amount: e.target.value })} className="input tabular" />
        </Field>
        <Field label="Date">
          <input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} className="input" />
        </Field>
        <Field label="Category">
          <Select value={f.category} onChange={(e) => set({ category: e.target.value })}>
            {[...new Set([...cats, f.category])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Payment method">
          <Select value={f.method} onChange={(e) => set({ method: e.target.value })}>
            <option value="">—</option>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label={f.type === "income" ? "From" : "Vendor"}>
          <input value={f.vendor} onChange={(e) => set({ vendor: e.target.value })} className="input" />
        </Field>
        <Field label="Subteam">
          <Select value={f.subteamId} onChange={(e) => set({ subteamId: e.target.value, taskId: "" })}>
            {fin && <option value="">General (team-wide)</option>}
            {dir.teams
              .filter((t) => fin || myTeams.includes(t.id))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Project">
          <Select value={f.projectId} onChange={(e) => set({ projectId: e.target.value })}>
            <option value="">None</option>
            {dir.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        {f.type === "expense" ? (
          <Field label="Task">
            <Select value={f.taskId} onChange={(e) => set({ taskId: e.target.value })}>
              <option value="">None</option>
              {teamTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {taskKey(t)} {t.title}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Sponsor">
            <Select value={f.sponsorId} onChange={(e) => set({ sponsorId: e.target.value })}>
              <option value="">None</option>
              {sponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {f.type === "expense" && (
          <>
            <Field label="Paid out of pocket by">
              <Select value={f.paidBy} onChange={(e) => set({ paidBy: e.target.value })}>
                <option value="">Nobody, paid from team funds</option>
                {activePeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            {f.paidBy ? (
              <Field label="Reimbursement">
                <Select value={f.reimbursement === "none" ? "pending" : f.reimbursement} onChange={(e) => set({ reimbursement: e.target.value as Tx["reimbursement"] })} disabled={!fin}>
                  <option value="pending">Owed to them</option>
                  <option value="reimbursed">Reimbursed</option>
                </Select>
              </Field>
            ) : (
              <div />
            )}
          </>
        )}
        <Field label="Receipt" className="sm:col-span-2">
          <ReceiptField value={f.receiptId} onChange={(receiptId) => set({ receiptId })} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} className="input" />
        </Field>
      </fieldset>
    </Dialog>
  );
}

/* ───────── Purchase request form ───────── */

export type RequestDraft = {
  id?: string;
  title: string;
  justification: string | null;
  items: RequestItem[];
  vendor: string | null;
  neededBy: string | null;
  urgent: boolean;
  subteamId: string;
  projectId: string | null;
  taskId: string | null;
};

export function RequestDialog({
  draft,
  tasks,
  currency,
  onClose,
}: {
  draft: Partial<RequestDraft>;
  tasks: { id: string; number: number; title: string; subteamId: string }[];
  currency: string;
  onClose: () => void;
}) {
  const { me, dir, taskKey } = useApp();
  const { run, pending } = useAction();
  const myTeams = me.isAdmin || isFinance(me) ? dir.teams : dir.teams.filter((t) => me.memberships.some((m) => m.subteamId === t.id));
  const [f, setF] = React.useState(() => ({
    title: draft.title ?? "",
    justification: draft.justification ?? "",
    items: draft.items?.length ? draft.items : [{ name: "", qty: 1, unitPrice: 0, link: "" }],
    vendor: draft.vendor ?? "",
    neededBy: draft.neededBy ?? "",
    urgent: draft.urgent ?? false,
    subteamId: draft.subteamId ?? myTeams[0]?.id ?? "",
    projectId: draft.projectId ?? "",
    taskId: draft.taskId ?? "",
  }));
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const setItem = (i: number, p: Partial<RequestItem>) => set({ items: f.items.map((it, j) => (j === i ? { ...it, ...p } : it)) });
  const total = f.items.reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={draft.id ? "Edit purchase request" : "Request a purchase"}
      description={draft.id ? undefined : "Your subteam head approves it first, then finance."}
      wide
      footer={
        <>
          <span className="mr-auto self-center text-[13px]">
            Total <span className="tabular font-semibold">{money(total, currency)}</span>
          </span>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  saveRequest(draft.id ?? null, {
                    ...f,
                    neededBy: f.neededBy || null,
                    items: f.items.filter((i) => i.name.trim()).map((i) => ({ name: i.name, qty: Number(i.qty), unitPrice: Number(i.unitPrice), link: i.link || undefined })),
                  }),
                { success: draft.id ? "Request updated" : "Request submitted", then: (r) => r.ok && onClose() },
              )
            }
          >
            {draft.id ? "Save" : "Submit request"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 pb-2 sm:grid-cols-2">
        <Field label="What do you need?" className="sm:col-span-2">
          <input autoFocus value={f.title} onChange={(e) => set({ title: e.target.value })} className="input" placeholder="e.g. Spare thrusters for pool tests" />
        </Field>
        <div className="sm:col-span-2">
          <span className="label">Items</span>
          <div className="space-y-1.5">
            <div className="hidden grid-cols-[1fr_64px_110px_1fr_28px] gap-1.5 text-[11px] text-subtle sm:grid">
              <span>Item</span>
              <span>Qty</span>
              <span>Unit price</span>
              <span>Link</span>
              <span />
            </div>
            {f.items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_64px_110px_28px] gap-1.5 sm:grid-cols-[1fr_64px_110px_1fr_28px]">
                <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} className="input" placeholder="Item name / part number" />
                <input type="number" min={1} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} className="input tabular" aria-label="Quantity" />
                <input type="number" min={0} step="0.01" value={it.unitPrice || ""} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} className="input tabular" placeholder={currency} aria-label="Unit price" />
                <input value={it.link ?? ""} onChange={(e) => setItem(i, { link: e.target.value })} className="input hidden sm:block" placeholder="https://" aria-label="Link" />
                <IconButton label="Remove item" disabled={f.items.length === 1} onClick={() => set({ items: f.items.filter((_, j) => j !== i) })} className="size-8">
                  <Trash2 />
                </IconButton>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => set({ items: [...f.items, { name: "", qty: 1, unitPrice: 0, link: "" }] })}>
              <Plus />
              Add item
            </Button>
          </div>
        </div>
        <Field label="Subteam">
          <Select value={f.subteamId} onChange={(e) => set({ subteamId: e.target.value, taskId: "" })}>
            {myTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vendor">
          <input value={f.vendor} onChange={(e) => set({ vendor: e.target.value })} className="input" placeholder="Where to buy" />
        </Field>
        <Field label="Project">
          <Select value={f.projectId} onChange={(e) => set({ projectId: e.target.value })}>
            <option value="">None</option>
            {dir.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="For task">
          <Select value={f.taskId} onChange={(e) => set({ taskId: e.target.value })}>
            <option value="">None</option>
            {tasks
              .filter((t) => t.subteamId === f.subteamId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {taskKey(t)} {t.title}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Needed by">
          <input type="date" value={f.neededBy} onChange={(e) => set({ neededBy: e.target.value })} className="input" />
        </Field>
        <div className="flex items-end pb-1.5">
          <Toggle checked={f.urgent} onChange={(urgent) => set({ urgent })} label="Urgent" />
        </div>
        <Field label="Why is it needed?" className="sm:col-span-2">
          <textarea rows={2} value={f.justification} onChange={(e) => set({ justification: e.target.value })} className="input" placeholder="Helps your head and finance approve faster" />
        </Field>
      </div>
    </Dialog>
  );
}

export function OrderDialog({ request, settings, onClose }: { request: { id: string; title: string; total: number; vendor: string | null }; settings: Settings; onClose: () => void }) {
  const { activePeople } = useApp();
  const { run, pending } = useAction();
  const [f, setF] = React.useState({ amount: String(request.total), date: todayISO(), method: "", vendor: request.vendor ?? "", category: settings.expenseCategories[0], paidBy: "", receiptId: null as string | null });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title="Mark as ordered"
      description="This records the expense in the ledger and links it to the request."
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={pending} onClick={() => run(() => orderRequest(request.id, { ...f, amount: Number(f.amount) }), { success: "Marked as ordered", then: (r) => r.ok && onClose() })}>
            Record expense
          </Button>
        </>
      }
    >
      <div className="grid gap-3 pb-2 sm:grid-cols-2">
        <Field label={`Actual amount (${settings.currency})`}>
          <input type="number" value={f.amount} onChange={(e) => set({ amount: e.target.value })} className="input tabular" />
        </Field>
        <Field label="Date">
          <input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} className="input" />
        </Field>
        <Field label="Category">
          <Select value={f.category} onChange={(e) => set({ category: e.target.value })}>
            {settings.expenseCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Payment method">
          <Select value={f.method} onChange={(e) => set({ method: e.target.value })}>
            <option value="">—</option>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="Vendor">
          <input value={f.vendor} onChange={(e) => set({ vendor: e.target.value })} className="input" />
        </Field>
        <Field label="Paid out of pocket by">
          <Select value={f.paidBy} onChange={(e) => set({ paidBy: e.target.value })}>
            <option value="">Nobody, paid from team funds</option>
            {activePeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Receipt" className="sm:col-span-2">
          <ReceiptField value={f.receiptId} onChange={(receiptId) => set({ receiptId })} />
        </Field>
      </div>
    </Dialog>
  );
}

/* ───────── Sponsors ───────── */

export type SponsorData = {
  id: string;
  name: string;
  tier: string | null;
  status: SponsorStatus;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  pledged: number;
  inKind: string | null;
  ownerId: string | null;
  nextFollowUp: string | null;
  notes: string | null;
};

export function SponsorDialog({ sponsor, currency, onClose }: { sponsor?: SponsorData; currency: string; onClose: () => void }) {
  const { activePeople, me } = useApp();
  const { run, pending } = useAction();
  const [f, setF] = React.useState(() => ({
    name: sponsor?.name ?? "",
    tier: sponsor?.tier ?? "",
    status: sponsor?.status ?? ("prospect" as SponsorStatus),
    contactName: sponsor?.contactName ?? "",
    contactEmail: sponsor?.contactEmail ?? "",
    contactPhone: sponsor?.contactPhone ?? "",
    pledged: sponsor?.pledged?.toString() ?? "0",
    inKind: sponsor?.inKind ?? "",
    ownerId: sponsor?.ownerId ?? me.id,
    nextFollowUp: sponsor?.nextFollowUp ?? "",
    notes: sponsor?.notes ?? "",
  }));
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={sponsor ? sponsor.name : "Add sponsor"}
      wide
      footer={
        <>
          {sponsor && isFinance(me) && (
            <Button variant="danger" className="mr-auto" onClick={() => confirm("Remove this sponsor?") && run(() => deleteSponsor(sponsor.id), { then: onClose })}>
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={pending || !f.name.trim()} onClick={() => run(() => saveSponsor(sponsor?.id ?? null, { ...f, pledged: Number(f.pledged) || 0 }), { success: "Saved", then: (r) => r.ok && onClose() })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 pb-2 sm:grid-cols-2">
        <Field label="Organization">
          <input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} className="input" />
        </Field>
        <Field label="Status">
          <Select value={f.status} onChange={(e) => set({ status: e.target.value as SponsorStatus })}>
            {SPONSOR_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tier">
          <input value={f.tier} onChange={(e) => set({ tier: e.target.value })} className="input" placeholder="Gold, Silver, In-kind…" />
        </Field>
        <Field label={`Pledged (${currency})`}>
          <input type="number" min={0} value={f.pledged} onChange={(e) => set({ pledged: e.target.value })} className="input tabular" />
        </Field>
        <Field label="In-kind support" className="sm:col-span-2">
          <input value={f.inKind} onChange={(e) => set({ inKind: e.target.value })} className="input" placeholder="Machining, components, venue…" />
        </Field>
        <Field label="Contact name">
          <input value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} className="input" />
        </Field>
        <Field label="Contact email">
          <input type="email" value={f.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} className="input" />
        </Field>
        <Field label="Contact phone">
          <input value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} className="input" />
        </Field>
        <Field label="Owner on our side">
          <Select value={f.ownerId ?? ""} onChange={(e) => set({ ownerId: e.target.value })}>
            <option value="">Nobody</option>
            {activePeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Next follow-up">
          <input type="date" value={f.nextFollowUp} onChange={(e) => set({ nextFollowUp: e.target.value })} className="input" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} className="input" placeholder="Deliverables promised (logo on ROV, social posts…), meeting notes" />
        </Field>
      </div>
    </Dialog>
  );
}
