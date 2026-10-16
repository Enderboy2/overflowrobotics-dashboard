"use client";

import * as React from "react";
import { useApp } from "@/components/app-context";
import { Button, Card, Field, useAction } from "@/components/ui";
import { changePassword, updateProfile } from "@/lib/actions/misc";

export function SettingsClient({ phone }: { phone: string }) {
  const { me } = useApp();
  const { run, pending } = useAction();
  const [p, setP] = React.useState({ name: me.name, title: me.title ?? "", phone });
  const [pw, setPw] = React.useState({ current: "", next: "", confirm: "" });
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 md:px-6">
      <Card title="Profile">
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Full name">
            <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} className="input" />
          </Field>
          <Field label="Email">
            <input value={me.email} disabled className="input text-muted" />
          </Field>
          <Field label="Title">
            <input value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} className="input" placeholder="e.g. Pilot" />
          </Field>
          <Field label="Phone">
            <input value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} className="input" />
          </Field>
          <div className="sm:col-span-2">
            <Button variant="primary" disabled={pending} onClick={() => run(() => updateProfile(p), { success: "Profile saved" })}>
              Save profile
            </Button>
          </div>
        </div>
      </Card>
      <Card title="Password">
        <form
          className="grid gap-3 p-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw.next !== pw.confirm) return alert("New passwords don't match.");
            run(() => changePassword(pw.current, pw.next), { success: "Password changed", then: (r) => r.ok && setPw({ current: "", next: "", confirm: "" }) });
          }}
        >
          <Field label="Current password">
            <input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className="input" />
          </Field>
          <Field label="New password">
            <input type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className="input" />
          </Field>
          <Field label="Confirm">
            <input type="password" autoComplete="new-password" minLength={8} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="input" />
          </Field>
          <div className="sm:col-span-3">
            <Button disabled={pending || !pw.next}>Change password</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
