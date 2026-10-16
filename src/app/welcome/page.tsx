import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { WelcomeForm } from "./form";

export const metadata = { title: "Set your password" };

export default async function Welcome() {
  const me = await requireMe();
  if (!me.mustChangePassword) redirect("/");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-[340px]">
        <img src="/brand/mark-dark.png" alt="" className="mb-8 size-9 dark:hidden" />
        <img src="/brand/mark-white.png" alt="" className="mb-8 hidden size-9 dark:block" />
        <h1 className="text-lg font-semibold tracking-tight">Welcome, {me.name.split(" ")[0]}</h1>
        <p className="mt-1 text-[13px] text-muted">Choose a new password to replace the temporary one you were given.</p>
        <WelcomeForm />
      </div>
    </main>
  );
}
