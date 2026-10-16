import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { LoginForm } from "./form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getMe()) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-[340px]">
        <img src="/brand/wordmark-dark.png" alt="Overflow Robotics" className="mb-10 h-7 w-auto dark:hidden" />
        <img src="/brand/wordmark-white.png" alt="Overflow Robotics" className="mb-10 hidden h-7 w-auto dark:block" />
        <h1 className="text-lg font-semibold tracking-tight">Sign in to the dashboard</h1>
        <p className="mt-1 text-[13px] text-muted">For Overflow Robotics members only.</p>
        <LoginForm next={next ?? "/"} />
        <p className="mt-8 text-xs leading-relaxed text-subtle">
          No account yet, or forgot your password? Ask the team admin. They can create your account or reset your password.
        </p>
      </div>
    </main>
  );
}
