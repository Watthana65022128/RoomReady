import { notFound } from "next/navigation";
import { groupBillGateway } from "@/lib/group-bill";
import { GroupBillRooms } from "@/components/group-bill-rooms";
import type { GroupBillListing } from "@/lib/domain";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();
  const response = await groupBillGateway(token);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("โหลดรายการบิลไม่สำเร็จ กรุณาลองอีกครั้ง");
  const listing: GroupBillListing = await response.json();
  const { month } = await searchParams;
  return (
    <GroupBillRooms token={token} listing={listing} initialMonth={month} />
  );
}
