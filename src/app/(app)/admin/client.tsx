"use client";

import * as React from "react";
import { Copy, KeyRound, Pencil, Plus, Search, UserPlus } from "lucide-react";
import { useApp, type Settings } from "@/components/app-context";
import { Avatar, Badge, Button, Card, Dialog, Dot, Field, IconButton, Select, Toggle, useAction, useToast } from "@/components/ui";
import { ActivityFeed, type ActivityItem } from "@/components/lists";
import { createUser, resetPassword, saveSettings, saveSubteam, setActive, updateUser } from "@/lib/actions/admin";
import { ROLE_LABEL } from "@/lib/meta";
import { ago, cn } from "@/lib/utils";
import type { SubteamRole } from "@/db/schema";

type U = { id: string; name: string; email: string; title: string | null; isAdmin: boolean; financeAccess: boolean; active: boolean; lastSeenAt: string | null; mustChangePassword: boolean };

export function AdminClient({ users, settings, activity }: { users: U[]; settings: Settings; activity: ActivityItem[] }) {
  const [tab, setTab] = React.useState<"members" | "subteams" | "settings" | "audit">("members");
  return (
    <>
      <nav className="flex gap-1 border-b border-line px-4 md:px-6">
        {(
          [
            ["members", "Members"],
            ["subteams", "Subteams"],
            ["settings", "Settings"],
            ["audit", "Audit log"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn("relative flex h-10 items-center px-2 text-[13px]", tab === id ? "font-medium after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-fg" : "text-muted hover:text-fg")}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
        {tab === "members" && <Members users={users} />}
        {tab === "subteams" && <Subteams />}
        {tab === "settings" && <SettingsForm settings={settings} />}
        {tab === "audit" && <Audit activity={activity} />}
      </div>
    </>
  );
}

function Members({ users }: { users: U[] }) {
  const { dir, me } = useApp();
  const { run } = useAction();
  const [edit, setEdit] = React.useState<U | "new" | null>(null);
  const [secret, setSecret] = React.useState<{ name: string; email: string; password: string } | null>(null);
  const [q, setQ] = React.useState("");
  const [showInactive, setShowInactive] = React.useState(false);
  const list = users.filter((u) => (showInactive || u.active) && `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" className="h-7 w-56 rounded-md border border-line bg-surface pl-7 pr-2 text-[12.5px] outline-none placeholder:text-subtle" />
        </div>
        <Toggle checked={showInactive} onChange={setShowInactive} label="Show deactivated" />
        <Button size="sm" variant="primary" className="ml-auto" onClick={() => setEdit("new")}>
          <UserPlus />
          Add member
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2 font-normal">Member</th>
              <th className="px-2 py-2 font-normal">Subteams</th>
              <th className="px-2 py-2 font-normal">Access</th>
              <th className="px-2 py-2 font-normal">Last active</th>
              <th className="px-4 py-2 text-right font-normal" />
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className={cn("border-b border-line/70 last:border-0", !u.active && "opacity-55")}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar id={u.id} name={u.name} size={26} />
                    <div className="min-w-0">
                      <div className="font-medium">{u.name}</div>
                      <div className="truncate text-xs text-muted">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    {dir.memberships
                      .filter((m) => m.userId === u.id)
                      .map((m) => {
                        const t = dir.teams.find((x) => x.id === m.subteamId)!;
                        return (
                          <span key={m.subteamId} className="flex items-center gap-1.5 text-muted">
                            <Dot color={t.color} />
                            {t.name}
                            {m.role !== "member" && <span className="font-medium text-fg">{ROLE_LABEL[m.role]}</span>}
                          </span>
                        );
                      })}
                  </div>
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {u.isAdmin && <Badge tone="violet">Admin</Badge>}
                    {u.financeAccess && <Badge tone="green">Finance</Badge>}
                    {!u.active && <Badge>Deactivated</Badge>}
                    {u.mustChangePassword && u.active && <Badge tone="amber">Awaiting first login</Badge>}
                  </div>
                </td>
                <td className="px-2 py-2.5 text-xs text-muted">{u.lastSeenAt ? ago(u.lastSeenAt) : "Never"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <IconButton label="Edit" onClick={() => setEdit(u)}>
                      <Pencil />
                    </IconButton>
                    <IconButton
                      label="Reset password"
                      onClick={() =>
                        confirm(`Reset ${u.name}'s password? They'll be signed out everywhere and must set a new one.`) &&
                        run(() => resetPassword(u.id), { then: (r) => r.ok && setSecret({ name: u.name, email: u.email, password: r.data.password }) })
                      }
                    >
                      <KeyRound />
                    </IconButton>
                    {u.id !== me.id && (
                      <Button size="sm" variant="ghost" onClick={() => confirm(`${u.active ? "Deactivate" : "Reactivate"} ${u.name}?`) && run(() => setActive(u.id, !u.active))}>
                        {u.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <UserDialog user={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} onCreated={(s) => setSecret(s)} />}
      {secret && <SecretDialog {...secret} onClose={() => setSecret(null)} />}
    </>
  );
}

function SecretDialog({ name, email, password, onClose }: { name: string; email: string; password: string; onClose: () => void }) {
  const toast = useToast();
  const text = `Your Overflow dashboard account is ready.\n\nSign in at ${typeof location !== "undefined" ? location.origin : ""}/login\nEmail: ${email}\nTemporary password: ${password}\n\nYou'll be asked to choose your own password when you sign in.`;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={`Login details for ${name}`} description="Share these privately. The temporary password is only shown once." footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="space-y-3 pb-2">
        <pre className="whitespace-pre-wrap rounded-md border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed">{text}</pre>
        <Button
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(text);
            toast("Copied");
          }}
        >
          <Copy />
          Copy message
        </Button>
      </div>
    </Dialog>
  );
}

function UserDialog({ user, onClose, onCreated }: { user?: U; onClose: () => void; onCreated: (s: { name: string; email: string; password: string }) => void }) {
  const { dir } = useApp();
  const { run, pending } = useAction();
  const [f, setF] = React.useState(() => ({
    name: user?.name ?? "",
    email: user?.email ?? "",
    title: user?.title ?? "",
    isAdmin: user?.isAdmin ?? false,
    financeAccess: user?.financeAccess ?? false,
    roles: Object.fromEntries(dir.teams.map((t) => [t.id, (user && dir.memberships.find((m) => m.userId === user.id && m.subteamId === t.id)?.role) || ""])) as Record<string, SubteamRole | "">,
  }));
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const submit = () => {
    const payload = {
      name: f.name,
      email: f.email,
      title: f.title,
      isAdmin: f.isAdmin,
      financeAccess: f.financeAccess,
      memberships: Object.entries(f.roles)
        .filter(([, r]) => r)
        .map(([subteamId, role]) => ({ subteamId, role: role as SubteamRole })),
    };
    if (user) run(() => updateUser(user.id, payload), { success: "Member updated", then: (r) => r.ok && onClose() });
    else
      run(() => createUser(payload), {
        then: (r) => {
          if (!r.ok) return;
          onClose();
          onCreated({ name: f.name, email: f.email.trim().toLowerCase(), password: r.data.password });
        },
      });
  };
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={user ? `Edit ${user.name}` : "Add member"}
      description={user ? undefined : "They get a temporary password and choose their own on first login."}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={pending || !f.name.trim() || !f.email.trim()} onClick={submit}>
            {user ? "Save" : (
              <>
                <Plus />
                Create account
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 pb-2 sm:grid-cols-2">
        <Field label="Full name">
          <input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} className="input" />
        </Field>
        <Field label="Email">
          <input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} className="input" />
        </Field>
        <Field label="Title" className="sm:col-span-2">
          <input value={f.title} onChange={(e) => set({ title: e.target.value })} className="input" placeholder="e.g. Pilot, CAD lead, Treasurer" />
        </Field>
        <div className="sm:col-span-2">
          <span className="label">Subteams and roles</span>
          <div className="divide-y divide-line rounded-md border border-line">
            {dir.teams.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2">
                <Dot color={t.color} />
                <span className="flex-1 text-[13px]">{t.name}</span>
                <Select value={f.roles[t.id]} onChange={(e) => set({ roles: { ...f.roles, [t.id]: e.target.value as SubteamRole | "" } })} className="h-7 w-36 text-xs">
                  <option value="">Not a member</option>
                  <option value="member">Member</option>
                  <option value="cohead">Co-head</option>
                  <option value="head">Head</option>
                </Select>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-subtle">Heads and co-heads can create and manage tasks, approve purchase requests and edit inventory for their subteam.</p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Toggle checked={f.financeAccess} onChange={(v) => set({ financeAccess: v })} label="Finance access: sees all money, approves purchases, records income" />
          <Toggle checked={f.isAdmin} onChange={(v) => set({ isAdmin: v })} label="Admin: full access to everything, including this page" />
        </div>
      </div>
    </Dialog>
  );
}

function Subteams() {
  const { dir, team } = useApp();
  const [edit, setEdit] = React.useState<string | "new" | null>(null);
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="primary" onClick={() => setEdit("new")}>
          <Plus />
          Add subteam
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {dir.teams.map((t) => {
          const ms = dir.memberships.filter((m) => m.subteamId === t.id);
          return (
            <Card key={t.id} title={<span className="flex items-center gap-2"><Dot color={t.color} />{t.name} <span className="font-mono text-xs text-subtle">{t.code}</span></span>} action={<IconButton label="Edit" onClick={() => setEdit(t.id)}><Pencil /></IconButton>}>
              <div className="p-4 text-[13px] text-muted">
                <p>{t.description || "No description"}</p>
                <p className="mt-2 text-xs">
                  {ms.length} members · {ms.filter((m) => m.role === "head").length} head · {ms.filter((m) => m.role === "cohead").length} co-head
                </p>
              </div>
            </Card>
          );
        })}
      </div>
      {edit && <SubteamDialog team={edit === "new" ? undefined : team(edit)} onClose={() => setEdit(null)} />}
    </>
  );
}

function SubteamDialog({ team, onClose }: { team?: { id: string; name: string; code: string; color: string; description: string | null }; onClose: () => void }) {
  const { run, pending } = useAction();
  const [f, setF] = React.useState({ name: team?.name ?? "", code: team?.code ?? "", color: team?.color ?? "#3E63DD", description: team?.description ?? "" });
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={team ? `Edit ${team.name}` : "Add subteam"}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={pending} onClick={() => run(() => saveSubteam(team?.id ?? null, f), { success: "Saved", then: (r) => r.ok && onClose() })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_90px_60px] gap-3 pb-2">
        <Field label="Name">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="input" />
        </Field>
        <Field label="Task prefix">
          <input value={f.code} maxLength={4} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className="input font-mono" />
        </Field>
        <Field label="Color">
          <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-8 w-full cursor-pointer rounded-md border border-line bg-surface" />
        </Field>
        <Field label="Description" className="col-span-3">
          <textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="input" />
        </Field>
      </div>
    </Dialog>
  );
}

function SettingsForm({ settings }: { settings: Settings }) {
  const { run, pending } = useAction();
  const [f, setF] = React.useState({
    teamName: settings.teamName,
    currency: settings.currency,
    season: settings.season,
    seasonStart: settings.seasonStart,
    expenseCategories: settings.expenseCategories.join("\n"),
    incomeCategories: settings.incomeCategories.join("\n"),
    labels: settings.labels.join("\n"),
  });
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  return (
    <div className="max-w-3xl">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Team name">
          <input value={f.teamName} onChange={(e) => setF({ ...f, teamName: e.target.value })} className="input" />
        </Field>
        <Field label="Currency code">
          <input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} className="input" />
        </Field>
        <Field label="Current season">
          <input value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })} className="input" placeholder="2026–27" />
        </Field>
        <Field label="Season started on">
          <input type="date" value={f.seasonStart} onChange={(e) => setF({ ...f, seasonStart: e.target.value })} className="input" />
        </Field>
        <Field label="Expense categories (one per line)">
          <textarea rows={10} value={f.expenseCategories} onChange={(e) => setF({ ...f, expenseCategories: e.target.value })} className="input" />
        </Field>
        <Field label="Income categories (one per line)">
          <textarea rows={10} value={f.incomeCategories} onChange={(e) => setF({ ...f, incomeCategories: e.target.value })} className="input" />
        </Field>
        <Field label="Task labels (one per line)">
          <textarea rows={8} value={f.labels} onChange={(e) => setF({ ...f, labels: e.target.value })} className="input" />
        </Field>
      </div>
      <p className="mt-3 text-xs text-subtle">Starting a new season: set the new season name and start date, then set budgets for it under Finance → Budgets. Past transactions are kept.</p>
      <Button
        variant="primary"
        className="mt-4"
        disabled={pending}
        onClick={() =>
          run(() => saveSettings({ ...f, expenseCategories: lines(f.expenseCategories), incomeCategories: lines(f.incomeCategories), labels: lines(f.labels) }), { success: "Settings saved" })
        }
      >
        Save settings
      </Button>
    </div>
  );
}

function Audit({ activity }: { activity: ActivityItem[] }) {
  const [entity, setEntity] = React.useState("all");
  const list = activity.filter((a) => entity === "all" || a.entity === entity);
  const kinds = [...new Set(activity.map((a) => a.entity))];
  return (
    <>
      <div className="mb-3">
        <Select value={entity} onChange={(e) => setEntity(e.target.value)} className="h-7 w-48 text-xs">
          <option value="all">Everything</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k[0].toUpperCase() + k.slice(1)}
            </option>
          ))}
        </Select>
      </div>
      <Card>
        <ActivityFeed items={list} />
      </Card>
    </>
  );
}
