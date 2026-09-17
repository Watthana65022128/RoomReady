import Link from "next/link";
import { notFound } from "next/navigation";
import { groupBillGateway } from "@/lib/group-bill";
import { TenantBill } from "@/components/tenant-bill";
import type { GroupPublicBill } from "@/lib/domain";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string; invoiceId: string }>;
}) {
  const { token, invoiceId } = await params;
  if (!/^[a-f0-9]{64}$/.test(token) || !/^[0-9a-f-]{36}$/i.test(invoiceId))
    notFound();
  const response = await groupBillGateway(token, invoiceId);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("โหลดบิลไม่สำเร็จ กรุณาลองอีกครั้ง");
  const bill: GroupPublicBill = await response.json();
  return (
    <>
      <nav className="group-bill-back">
        <Link href={`/h/${token}?month=${bill.month}`}>← กลับไปเลือกห้อง</Link>
      </nav>
      <TenantBill
        bill={bill}
        uploadUrl={`/api/h/${token}/${invoiceId}/slip`}
        group
      />
    </>
  );
}
