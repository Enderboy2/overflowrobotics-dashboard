"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ExternalLink, Plus, Receipt, X } from "lucide-react";
import { useApp, type Settings } from "@/components/app-context";
import { Avatar, Badge, Button, Dialog, Dot, Empty, Toggle, useAction } from "@/components/ui";
import { OrderDialog, RequestDialog, type RequestDraft } from "@/components/finance-forms";
import { cancelRequest, decideRequest, receiveRequest } from "@/lib/actions/finance";
import { REQUEST_STATUSES } from "@/lib/meta";
import { isFinance, manages } from "@/lib/perm";
import { cn, dateTime, longDate, money, shortDate } from "@/lib/utils";
import type { RequestRow } from "@/lib/queries";

type Tab = "action" | "open" | "done" | "all";

export function RequestsClient({ rows, settings, tasks }: { rows: RequestRow[]; settings: Settings; tasks: { id: string; number: number; title: string; subteamId: string }[] }) {
  const { me, team, person } = useApp();
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const needsMe = (r: RequestRow) => (r.status === "pending" && manages(me, r.subteamId)) || (r.status === "head_approved" && isFinance(me)) || (r.status === "approved" && (isFinance(me) || manages(me, r.subteamId)));
  const action = rows.filter(needsMe);
  const [tab, setTab] = React.useState<Tab>(action.length ? "action" : "open");
  const [draft, setDraft] = React.useState<Partial<RequestDraft> | null>(null);
  const openNum = Number(sp.get("r")) || null;
  const selected = rows.find((r) => r.number === openNum) ?? null;

  React.useEffect(() => {
    if (sp.get("new")) {
      setDraft({ taskId: sp.get("task"), subteamId: sp.get("team") ?? undefined, projectId: sp.get("project") });
      router.replace(path, { scroll: false });
    }
  }, [sp, router, path]);

  const list = rows.filter((r) =>
    tab === "action" ? needsMe(r) : tab === "open" ? ["pending", "head_approved", "approved", "ordered"].includes(r.status) : tab === "done" ? ["received", "rejected", "cancelled"].includes(r.status) : true,
  );
  const tabs: [Tab, string, number][] = [
    ["action", "Needs my action", action.length],
    ["open", "Open", rows.filter((r) => ["pending", "head_approved", "approved", "ordered"].includes(r.status)).length],
    ["done", "Closed", 0],
    ["all", "All", 0],
  ];
  const openReq = (n: number | null) => router.push(n ? `${path}?r=${n}` : path, { scroll: false });

  return (
    <div className="px-4 py-4 md:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-line bg-surface p-0.5">
          {tabs.map(([id, label, n]) => (
            <button key={id} onClick={() => setTab(id)} className={cn("flex h-6 items-center gap-1 rounded px-2.5 text-[12.5px]", tab === id ? "bg-surface-3 font-medium" : "text-muted hover:text-fg")}>
              {label}
              {n > 0 && <span className={cn("tabular rounded px-1 text-[10.5px]", id === "action" ? "bg-accent text-white" : "text-subtle")}>{n}</span>}
            </button>
          ))}
        </div>
        <Button size="sm" variant="primary" className="ml-auto" onClick={() => setDraft({})}>
          <Plus />
          New request
        </Button>
      </div>

      {list.length === 0 ? (
        <Empty icon={<Receipt />} title={tab === "action" ? "Nothing needs your action" : "No purchase requests"}>
          Need parts or tools? Request them here. Your head approves first, then finance, then the expense is recorded automatically.
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          {list.map((r) => {
            const st = REQUEST_STATUSES.find((x) => x.id === r.status)!;
            const t = team(r.subteamId);
            const p = person(r.requestedBy);
            return (
              <button key={r.id} onClick={() => openReq(r.number)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-surface-2/60 md:grid-cols-[64px_1fr_140px_130px_90px_110px]">
                <span className="hidden font-mono text-[11.5px] text-subtle md:block">PR-{r.number}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[13px]">
                    <span className="truncate font-medium">{r.title}</span>
                    {r.urgent && <span className="text-[11px] font-medium text-bad">Urgent</span>}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    {t && <Dot color={t.color} />}
                    {t?.name} · {p?.name ?? "—"} · {r.items.length} item{r.items.length === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="hidden md:block">
                  <Badge tone={st.tone}>{st.label}</Badge>
                </span>
                <span className="hidden text-xs text-muted md:block">{r.neededBy ? `Needed ${shortDate(r.neededBy)}` : "—"}</span>
                <span className="hidden text-xs text-subtle md:block">{shortDate(r.createdAt)}</span>
                <span className="tabular text-right text-[13px] font-medium">{money(r.total, settings.currency)}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected && <RequestDetail r={selected} settings={settings} tasks={tasks} onClose={() => openReq(null)} onEdit={() => setDraft({ ...selected, justification: selected.justification })} />}
      {draft && <RequestDialog draft={draft} tasks={tasks} currency={settings.currency} onClose={() => setDraft(null)} />}
    </div>
  );
}

function RequestDetail({ r, settings, tasks, onClose, onEdit }: { r: RequestRow; settings: Settings; tasks: { id: string; number: number; title: string; subteamId: string }[]; onClose: () => void; onEdit: () => void }) {
  const { me, team, person, project, taskKey } = useApp();
  const { run, pending } = useAction();
  const [ordering, setOrdering] = React.useState(false);
  const [toInventory, setToInventory] = React.useState(true);
  const st = REQUEST_STATUSES.find((x) => x.id === r.status)!;
  const task = tasks.find((t) => t.id === r.taskId);
  const fin = isFinance(me);
  const lead = manages(me, r.subteamId);
  const canApprove = (r.status === "pending" && lead) || (r.status === "head_approved" && fin);
  const canReject = (r.status === "pending" && lead) || (["pending", "head_approved", "approved"].includes(r.status) && fin);
  const canOrder = r.status === "approved" && (fin || lead);
  const canReceive = r.status === "ordered" && (fin || lead || r.requestedBy === me.id);
  const canEdit = (r.requestedBy === me.id && r.status === "pending") || ((fin || lead) && !["ordered", "received"].includes(r.status));
  const canCancel = (r.requestedBy === me.id || fin) && !["ordered", "received", "rejected", "cancelled"].includes(r.status);

  const steps = [
    { label: "Requested", who: r.requestedBy, at: r.createdAt, done: true },
    { label: "Head approval", who: r.headApprovedBy, at: r.headApprovedAt, done: !!r.headApprovedAt },
    { label: "Finance approval", who: r.approvedBy, at: r.approvedAt, done: !!r.approvedAt },
    { label: "Ordered", done: ["ordered", "received"].includes(r.status) },
    { label: "Received", done: r.status === "received" },
  ];

  return (
    <>
      <Dialog
        open
        onOpenChange={(v) => !v && onClose()}
        title={r.title}
        description={`PR-${r.number} · ${team(r.subteamId)?.name} · requested by ${person(r.requestedBy)?.name ?? "—"}`}
        wide
        footer={
          <>
            {canCancel && (
              <Button variant="ghost" className="mr-auto" onClick={() => confirm("Cancel this request?") && run(() => cancelRequest(r.id), { success: "Cancelled" })}>
                Cancel request
              </Button>
            )}
            {canEdit && <Button onClick={onEdit}>Edit</Button>}
            {canReject && (
              <Button
                variant="danger"
                disabled={pending}
                onClick={() => {
                  const reason = prompt("Reason for rejecting (shared with the requester):");
                  if (reason !== null) run(() => decideRequest(r.id, "reject", reason), { success: "Request rejected" });
                }}
              >
                <X />
                Reject
              </Button>
            )}
            {canApprove && (
              <Button variant="primary" disabled={pending} onClick={() => run(() => decideRequest(r.id, "approve"), { success: "Approved" })}>
                <Check />
                Approve
              </Button>
            )}
            {canOrder && (
              <Button variant="primary" onClick={() => setOrdering(true)}>
                Mark as ordered
              </Button>
            )}
            {canReceive && (
              <Button variant="primary" disabled={pending} onClick={() => run(() => receiveRequest(r.id, toInventory), { success: "Marked as received" })}>
                Mark as received
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-5 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            {r.urgent && <Badge tone="red">Urgent</Badge>}
            {r.neededBy && <span className="text-xs text-muted">Needed by {longDate(r.neededBy)}</span>}
          </div>

          <ol className="flex items-start">
            {steps.map((s, i) => (
              <li key={s.label} className="flex flex-1 flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <span className={cn("h-px flex-1", i === 0 ? "bg-transparent" : steps[i].done ? "bg-fg" : "bg-line")} />
                  <span className={cn("flex size-5 items-center justify-center rounded-full border text-[10px]", s.done ? "border-fg bg-fg text-bg" : "border-line-strong text-subtle")}>{s.done ? <Check className="size-3" /> : i + 1}</span>
                  <span className={cn("h-px flex-1", i === steps.length - 1 ? "bg-transparent" : steps[i + 1].done ? "bg-fg" : "bg-line")} />
                </div>
                <span className="mt-1.5 text-[11.5px] font-medium">{s.label}</span>
                {"who" in s && s.who && <span className="text-[11px] text-muted">{person(s.who)?.name.split(" ")[0]}</span>}
                {"at" in s && s.at && <span className="text-[10.5px] text-subtle">{dateTime(s.at)}</span>}
              </li>
            ))}
          </ol>
          {r.status === "rejected" && (
            <div className="rounded-md border border-bad/30 bg-bad/5 px-3 py-2 text-[13px] text-bad">
              Rejected{r.rejectionReason ? `: ${r.rejectionReason}` : ""}
            </div>
          )}

          <div className="overflow-hidden rounded-md border border-line">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-left text-xs text-muted">
                  <th className="px-3 py-1.5 font-normal">Item</th>
                  <th className="px-3 py-1.5 text-right font-normal">Qty</th>
                  <th className="px-3 py-1.5 text-right font-normal">Unit</th>
                  <th className="px-3 py-1.5 text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {r.items.map((it, i) => (
                  <tr key={i} className="border-b border-line/70 last:border-0">
                    <td className="px-3 py-2">
                      {it.link ? (
                        <a href={it.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                          {it.name}
                          <ExternalLink className="size-3 text-subtle" />
                        </a>
                      ) : (
                        it.name
                      )}
                    </td>
                    <td className="tabular px-3 py-2 text-right">{it.qty}</td>
                    <td className="tabular px-3 py-2 text-right text-muted">{money(it.unitPrice, settings.currency)}</td>
                    <td className="tabular px-3 py-2 text-right">{money(it.qty * it.unitPrice, settings.currency)}</td>
                  </tr>
                ))}
                <tr className="bg-surface-2/40">
                  <td colSpan={3} className="px-3 py-2 text-right text-xs text-muted">
                    Total
                  </td>
                  <td className="tabular px-3 py-2 text-right font-semibold">{money(r.total, settings.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
            {r.vendor && (
              <>
                <dt className="text-muted">Vendor</dt>
                <dd>{r.vendor}</dd>
              </>
            )}
            {r.projectId && (
              <>
                <dt className="text-muted">Project</dt>
                <dd>
                  <Link href={`/projects/${r.projectId}`} className="hover:underline">
                    {project(r.projectId)?.name}
                  </Link>
                </dd>
              </>
            )}
            {task && (
              <>
                <dt className="text-muted">Task</dt>
                <dd>
                  <Link href={`/tasks?task=${task.number}`} className="hover:underline">
                    <span className="font-mono text-xs text-subtle">{taskKey(task)}</span> {task.title}
                  </Link>
                </dd>
              </>
            )}
            {r.justification && (
              <>
                <dt className="text-muted">Reason</dt>
                <dd className="whitespace-pre-wrap">{r.justification}</dd>
              </>
            )}
            <dt className="text-muted">Requester</dt>
            <dd className="flex items-center gap-1.5">
              {r.requestedBy && <Avatar id={r.requestedBy} name={person(r.requestedBy)?.name ?? "?"} size={16} />}
              {person(r.requestedBy)?.name}
            </dd>
          </dl>
          {canReceive && <Toggle checked={toInventory} onChange={setToInventory} label="Add received items to inventory" />}
        </div>
      </Dialog>
      {ordering && <OrderDialog request={r} settings={settings} onClose={() => setOrdering(false)} />}
    </>
  );
}
