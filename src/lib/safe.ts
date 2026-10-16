import "server-only";

export type Result<T = unknown> = { ok: true; data: T; error?: undefined } | { ok: false; error: string; data?: undefined };

/** Wraps a server action so user-facing errors survive production error masking. */
export async function safe<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}
