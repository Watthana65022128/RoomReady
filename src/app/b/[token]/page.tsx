import { notFound } from "next/navigation";
import { billGateway } from "@/lib/public-bill";
import type { PublicBill } from "@/lib/domain";
import { TenantBill } from "@/components/tenant-bill";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();
  const response = await billGateway(token);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("โหลดบิลไม่สำเร็จ");
  const bill: PublicBill = await response.json();
  return <TenantBill bill={bill} token={token} />;
}
