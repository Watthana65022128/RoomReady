import { workspace } from "@/lib/data";
import { subscriptionContext } from "@/lib/subscription";
import { WorkspaceApp } from "@/components/workspace";
import { OwnerAccess } from "@/components/owner-access";
export const dynamic = "force-dynamic";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; tab?: string; month?: string }>;
}) {
  const [data, context, initial] = await Promise.all([
    workspace(),
    subscriptionContext(),
    searchParams,
  ]);
  return (
    <OwnerAccess subscription={context.subscription}>
      <WorkspaceApp
        data={data}
        subscription={context.subscription}
        initial={initial}
      />
    </OwnerAccess>
  );
}
