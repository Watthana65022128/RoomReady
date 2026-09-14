import { workspace } from "@/lib/data";
import { WorkspaceApp } from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; tab?: string; month?: string }>;
}) {
  return <WorkspaceApp data={await workspace()} initial={await searchParams} />;
}
