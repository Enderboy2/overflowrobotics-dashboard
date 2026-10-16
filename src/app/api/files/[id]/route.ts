import { eq } from "drizzle-orm";
import { getMe } from "@/lib/auth";
import { getDb, schema as s } from "@/db";
import { isLead, isFinance } from "@/lib/perm";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!me) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [f] = await db.select().from(s.files).where(eq(s.files.id, id));
  if (!f) return new Response("Not found", { status: 404 });
  // Receipts (files not attached to a task) are visible to finance, leads, and the uploader.
  if (!f.taskId && !(isFinance(me) || isLead(me) || f.uploadedBy === me.id)) return new Response("Forbidden", { status: 403 });
  const download = new URL(req.url).searchParams.has("download");
  const inline = !download && /^(image\/|application\/pdf|text\/plain)/.test(f.mime);
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": inline ? f.mime : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
