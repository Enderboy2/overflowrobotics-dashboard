import { requireMe } from "@/lib/auth";
import { TaskPage } from "./client";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return { title: `Task ${number}` };
}

export default async function Page({ params }: { params: Promise<{ number: string }> }) {
  await requireMe();
  const { number } = await params;
  return <TaskPage number={Number(number)} />;
}
