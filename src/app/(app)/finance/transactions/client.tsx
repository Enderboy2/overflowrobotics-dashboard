"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Download, Plus, Search, Paperclip, Wallet } from "lucide-react";
import { useApp, type Settings } from "@/components/app-context";
import { Button, Dot, Empty, Select } from "@/components/ui";
import { TxDialog, type Tx } from "@/components/finance-forms";
import { isFinance, managedSubteams } from "@/lib/perm";
import { cn, csv, money, shortDate } from "@/lib/utils";

export function TransactionsClient({ rows, settings, sponsors, tasks }: { rows: Tx[]; settings: Settings; sponsors: { id: string; name: string }[]; tasks: { id: string; number: number; title: string; subteamId: string }[] }) {
  const { me, dir, team, person, project, taskKey } = useApp();
  const sp = useSearchParams();
  const [type, setType] = React.useState<"all" | "income" | "expense">("all");
  const [teamF, setTeamF] = React.useState(sp.get("team") ?? "all");
  const [cat, setCat] = React.useState("all");
  const [month, setMonth] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [edit, setEdit] = React.useState<Tx | "new" | null>(null);
  const canAdd = isFinance(me) || managedSubteams(me).length > 0;
  const months = [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort().reverse();
  const cats = [...new Set(rows.map((r) => r.category))].sort();
  const list = rows.filter(
    (r) =>
      (type === "all" || r.type === type) &&
      (teamF === "all" || (teamF === "none" ? !r.subteamId : r.subteamId === teamF)) &&
      (cat === "all" || r.category === cat) &&
      (month === "all" || r.date.startsWith(month)) &&
      (!q || `${r.description} ${r.vendor ?? ""} ${r.notes ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const inc = list.filter((r) => r.type === "income").reduce((a, r) => a + r.amount, 0);
  const exp = list.filter((r) => r.type === "expense").reduce((a, r) => a + r.amount, 0);
  const exportCsv = () => {
    const data = [
      ["Date", "Type", "Description", "Category", "Amount", "Subteam", "Project", "Vendor", "Method", "Paid by", "Reimbursement", "Notes"],
      ...list.map((r) => [r.date, r.type, r.description, r.category, r.type === "expense" ? -r.amount : r.amount, team(r.subteamId)?.name, project(r.projectId)?.name, r.vendor, r.method, person(r.paidBy)?.name, r.reimbursement, r.notes]),
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv(data)], { type: "text/csv" }));
    a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };
  return (
    <div className="px-4 py-4 md:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <div className="flex rounded-md border border-line bg-surface p-0.5">
          {(["all", "income", "expense"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={cn("h-6 rounded px-2.5 text-[12.5px] capitalize", type === t ? "bg-surface-3 font-medium" : "text-muted hover:text-fg")}>
              {t === "all" ? "All" : t === "income" ? "Income" : "Expenses"}
            </button>
          ))}
        </div>
        <Select value={teamF} onChange={(e) => setTeamF(e.target.value)} className="h-7 w-auto text-xs">
          <option value="all">All subteams</option>
          {dir.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value="none">General / no subteam</option>
        </Select>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="h-7 w-auto text-xs">
          <option value="all">All categories</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select value={month} onChange={(e) => setMonth(e.target.value)} className="h-7 w-auto text-xs">
          <option value="all">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {format(new Date(m + "-01"), "MMMM yyyy")}
            </option>
          ))}
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-7 w-44 rounded-md border border-line bg-surface pl-7 pr-2 text-[12.5px] outline-none placeholder:text-subtle" />
        </div>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" onClick={exportCsv}>
            <Download />
            CSV
          </Button>
          {canAdd && (
            <Button size="sm" variant="primary" onClick={() => setEdit("new")}>
              <Plus />
              Add transaction
            </Button>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
        <span className="text-muted">
          {list.length} transactions
        </span>
        {isFinance(me) && (
          <span>
            Income <span className="tabular font-medium text-ok">{money(inc, settings.currency)}</span>
          </span>
        )}
        <span>
          Expenses <span className="tabular font-medium">{money(exp, settings.currency)}</span>
        </span>
        {isFinance(me) && (
          <span>
            Net <span className={cn("tabular font-medium", inc - exp < 0 && "text-bad")}>{money(inc - exp, settings.currency, { sign: true })}</span>
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <Empty icon={<Wallet />} title="No transactions">
          Record income and expenses here. Receipts can be attached to every entry.
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2 font-normal">Date</th>
                <th className="px-2 py-2 font-normal">Description</th>
                <th className="px-2 py-2 font-normal">Category</th>
                <th className="px-2 py-2 font-normal">Subteam</th>
                <th className="px-2 py-2 font-normal">Linked to</th>
                <th className="px-2 py-2 font-normal">Paid by</th>
                <th className="px-4 py-2 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const t = team(r.subteamId);
                const task = tasks.find((x) => x.id === r.taskId);
                return (
                  <tr key={r.id} onClick={() => setEdit(r)} className="cursor-default border-b border-line/70 last:border-0 hover:bg-surface-2/60">
                    <td className="tabular whitespace-nowrap px-4 py-2.5 text-muted">{shortDate(r.date)}</td>
                    <td className="max-w-[280px] px-2 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{r.description}</span>
                        {r.receiptId && <Paperclip className="size-3 shrink-0 text-subtle" aria-label="Has receipt" />}
                      </div>
                      {r.vendor && <div className="truncate text-xs text-subtle">{r.vendor}</div>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-muted">{r.category}</td>
                    <td className="whitespace-nowrap px-2 py-2.5">{t ? <span className="flex items-center gap-1.5 text-muted"><Dot color={t.color} />{t.name}</span> : <span className="text-subtle">General</span>}</td>
                    <td className="max-w-[200px] truncate px-2 py-2.5 text-xs text-muted">
                      {[project(r.projectId)?.name, task && taskKey(task), sponsors.find((s) => s.id === r.sponsorId)?.name].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-xs">
                      {r.paidBy ? (
                        <span className="flex items-center gap-1.5">
                          {person(r.paidBy)?.name.split(" ")[0]}
                          {r.reimbursement === "pending" && <span className="text-warn">· owed</span>}
                          {r.reimbursement === "reimbursed" && <span className="text-subtle">· repaid</span>}
                        </span>
                      ) : (
                        <span className="text-subtle">Team funds</span>
                      )}
                    </td>
                    <td className={cn("tabular whitespace-nowrap px-4 py-2.5 text-right font-medium", r.type === "income" && "text-ok")}>{money(r.type === "income" ? r.amount : -r.amount, settings.currency, { sign: true })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {edit && <TxDialog tx={edit === "new" ? undefined : edit} settings={settings} sponsors={sponsors} tasks={tasks} onClose={() => setEdit(null)} />}
    </div>
  );
}
