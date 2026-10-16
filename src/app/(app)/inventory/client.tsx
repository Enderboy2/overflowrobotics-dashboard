"use client";

import * as React from "react";
import Link from "next/link";
import { Minus, Package, Plus, Search } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Badge, Button, Chip, Dialog, Dot, Empty, Field, IconButton, Select, useAction } from "@/components/ui";
import { adjustItem, deleteItem, saveItem } from "@/lib/actions/misc";
import { isLead, managedSubteams } from "@/lib/perm";
import { ago, cn, money } from "@/lib/utils";

type Item = {
  id: string;
  name: string;
  partNumber: string | null;
  category: string | null;
  subteamId: string | null;
  quantity: number;
  minQuantity: number;
  unit: string | null;
  location: string | null;
  unitCost: number | null;
  requestId: string | null;
  notes: string | null;
  updatedAt: string;
};

export function InventoryClient({ items, currency }: { items: Item[]; currency: string }) {
  const { me, dir, team } = useApp();
  const { run } = useAction();
  const [teamF, setTeamF] = React.useState("all");
  const [low, setLow] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [edit, setEdit] = React.useState<Item | "new" | null>(null);
  const [local, setLocal] = React.useState(items);
  React.useEffect(() => setLocal(items), [items]);
  const list = local.filter(
    (i) =>
      (teamF === "all" || i.subteamId === teamF) &&
      (!low || i.quantity <= i.minQuantity) &&
      (!q || `${i.name} ${i.partNumber ?? ""} ${i.category ?? ""} ${i.location ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const lowCount = local.filter((i) => i.quantity <= i.minQuantity && i.minQuantity > 0).length;
  const value = list.reduce((a, i) => a + i.quantity * (i.unitCost ?? 0), 0);
  const adjust = (i: Item, d: number) => {
    setLocal((l) => l.map((x) => (x.id === i.id ? { ...x, quantity: Math.max(0, x.quantity + d) } : x)));
    run(() => adjustItem(i.id, d), { refresh: false });
  };
  return (
    <div className="px-4 py-4 md:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Chip active={teamF === "all"} onClick={() => setTeamF("all")}>
          All
        </Chip>
        {dir.teams.map((t) => (
          <Chip key={t.id} active={teamF === t.id} onClick={() => setTeamF(t.id)}>
            <Dot color={t.color} />
            {t.name}
          </Chip>
        ))}
        <Chip active={low} onClick={() => setLow((v) => !v)} className={lowCount ? "text-warn" : ""}>
          Low stock {lowCount > 0 && <span className="tabular">{lowCount}</span>}
        </Chip>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, part no., location" className="h-7 w-52 rounded-md border border-line bg-surface pl-7 pr-2 text-[12.5px] outline-none placeholder:text-subtle" />
        </div>
        <span className="ml-auto text-xs text-muted">Stock value {money(value, currency, { compact: true })}</span>
        {isLead(me) && (
          <Button size="sm" variant="primary" onClick={() => setEdit("new")}>
            <Plus />
            Add item
          </Button>
        )}
      </div>
      {!list.length ? (
        <Empty icon={<Package />} title="No items">
          Track parts, tools and spares. Received purchase requests can add items here automatically.
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2 font-normal">Item</th>
                <th className="px-2 py-2 font-normal">Category</th>
                <th className="px-2 py-2 font-normal">Subteam</th>
                <th className="px-2 py-2 font-normal">Location</th>
                <th className="px-2 py-2 text-center font-normal">Quantity</th>
                <th className="px-2 py-2 text-right font-normal">Unit cost</th>
                <th className="px-4 py-2 text-right font-normal">Updated</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const t = team(i.subteamId);
                const isLow = i.minQuantity > 0 && i.quantity <= i.minQuantity;
                return (
                  <tr key={i.id} className="border-b border-line/70 last:border-0 hover:bg-surface-2/60">
                    <td className="px-4 py-2">
                      <button onClick={() => setEdit(i)} className="text-left">
                        <div className="font-medium hover:underline">{i.name}</div>
                        {i.partNumber && <div className="font-mono text-[11px] text-subtle">{i.partNumber}</div>}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-muted">{i.category ?? "—"}</td>
                    <td className="px-2 py-2">{t ? <span className="flex items-center gap-1.5 text-muted"><Dot color={t.color} />{t.name}</span> : <span className="text-subtle">Shared</span>}</td>
                    <td className="px-2 py-2 text-muted">{i.location ?? "—"}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <IconButton label="Take one" className="size-6" onClick={() => adjust(i, -1)} disabled={i.quantity === 0}>
                          <Minus />
                        </IconButton>
                        <span className={cn("tabular w-16 text-center", isLow && "font-medium text-warn")}>
                          {i.quantity} <span className="text-xs font-normal text-subtle">{i.unit}</span>
                        </span>
                        <IconButton label="Add one" className="size-6" onClick={() => adjust(i, 1)}>
                          <Plus />
                        </IconButton>
                        {isLow && <Badge tone="amber">Low</Badge>}
                      </div>
                    </td>
                    <td className="tabular px-2 py-2 text-right text-muted">{i.unitCost ? money(i.unitCost, currency) : "—"}</td>
                    <td className="px-4 py-2 text-right text-xs text-subtle">
                      {ago(i.updatedAt)}
                      {i.requestId && (
                        <Link href="/finance/requests" className="ml-1 text-info hover:underline">
                          PR
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {edit && <ItemDialog item={edit === "new" ? undefined : edit} currency={currency} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ItemDialog({ item, currency, onClose }: { item?: Item; currency: string; onClose: () => void }) {
  const { me, dir } = useApp();
  const { run, pending } = useAction();
  const teams = me.isAdmin ? dir.teams : dir.teams.filter((t) => managedSubteams(me).includes(t.id));
  const canEdit = !item || me.isAdmin || (item.subteamId ? managedSubteams(me).includes(item.subteamId) : isLead(me));
  const [f, setF] = React.useState(() => ({
    name: item?.name ?? "",
    partNumber: item?.partNumber ?? "",
    category: item?.category ?? "",
    subteamId: item?.subteamId ?? teams[0]?.id ?? "",
    quantity: String(item?.quantity ?? 0),
    minQuantity: String(item?.minQuantity ?? 0),
    unit: item?.unit ?? "pcs",
    location: item?.location ?? "",
    unitCost: item?.unitCost?.toString() ?? "",
    notes: item?.notes ?? "",
  }));
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={item ? item.name : "Add item"}
      wide
      footer={
        canEdit ? (
          <>
            {item && (
              <Button variant="danger" className="mr-auto" onClick={() => confirm("Delete this item?") && run(() => deleteItem(item.id), { then: onClose })}>
                Delete
              </Button>
            )}
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              disabled={pending || !f.name.trim()}
              onClick={() =>
                run(
                  () =>
                    saveItem(item?.id ?? null, {
                      ...f,
                      subteamId: f.subteamId || null,
                      quantity: Number(f.quantity) || 0,
                      minQuantity: Number(f.minQuantity) || 0,
                      unitCost: f.unitCost ? Number(f.unitCost) : null,
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
        <Field label="Name">
          <input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} className="input" />
        </Field>
        <Field label="Part number">
          <input value={f.partNumber} onChange={(e) => set({ partNumber: e.target.value })} className="input" />
        </Field>
        <Field label="Category">
          <input value={f.category} onChange={(e) => set({ category: e.target.value })} className="input" placeholder="Fasteners, Connectors…" />
        </Field>
        <Field label="Subteam">
          <Select value={f.subteamId} onChange={(e) => set({ subteamId: e.target.value })}>
            {me.isAdmin && <option value="">Shared</option>}
            {(item?.subteamId && !teams.some((t) => t.id === item.subteamId) ? dir.teams : teams).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantity">
          <input type="number" min={0} value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} className="input tabular" />
        </Field>
        <Field label="Alert when at or below">
          <input type="number" min={0} value={f.minQuantity} onChange={(e) => set({ minQuantity: e.target.value })} className="input tabular" />
        </Field>
        <Field label="Unit">
          <input value={f.unit} onChange={(e) => set({ unit: e.target.value })} className="input" />
        </Field>
        <Field label={`Unit cost (${currency})`}>
          <input type="number" min={0} value={f.unitCost} onChange={(e) => set({ unitCost: e.target.value })} className="input tabular" />
        </Field>
        <Field label="Location" className="sm:col-span-2">
          <input value={f.location} onChange={(e) => set({ location: e.target.value })} className="input" placeholder="Shelf A2, Drawer F1…" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} className="input" />
        </Field>
      </fieldset>
    </Dialog>
  );
}
