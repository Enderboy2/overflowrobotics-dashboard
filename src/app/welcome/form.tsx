"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword } from "@/lib/actions/misc";
import { Button } from "@/components/ui";

export function WelcomeForm() {
  const router = useRouter();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (a !== b) return setErr("Passwords don't match.");
        setPending(true);
        const r = await changePassword("", a);
        setPending(false);
        if (r.error) return setErr(r.error);
        router.replace("/");
        router.refresh();
      }}
    >
      <label className="block">
        <span className="label">New password</span>
        <input type="password" value={a} onChange={(e) => setA(e.target.value)} minLength={8} required autoFocus autoComplete="new-password" className="input h-9" />
      </label>
      <label className="block">
        <span className="label">Confirm password</span>
        <input type="password" value={b} onChange={(e) => setB(e.target.value)} minLength={8} required autoComplete="new-password" className="input h-9" />
      </label>
      {err && <p className="text-[13px] text-bad">{err}</p>}
      <Button variant="primary" className="h-9 w-full" disabled={pending}>
        Continue
      </Button>
    </form>
  );
}
