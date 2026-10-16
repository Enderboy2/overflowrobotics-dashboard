"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/misc";
import { Button } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" autoComplete="email" required autoFocus className="input h-9" />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="input h-9" />
      </label>
      {state?.error && <p className="text-[13px] text-bad">{state.error}</p>}
      <Button variant="primary" className="h-9 w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
