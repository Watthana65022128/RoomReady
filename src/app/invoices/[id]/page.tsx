import { owner } from "@/lib/data";
import { readSubscription } from "@/lib/subscription";
import { OwnerAccess } from "@/components/owner-access";
import { paymentQrUrl } from "@/lib/payment-qr";
import { notFound } from "next/navigation";
import { InvoiceDetail } from "@/components/invoice-detail";
import { safeReturnTo } from "@/lib/navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, user } = await owner();
  const { data: invoice, error } = await db
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) throw new Error("โหลดบิลไม่สำเร็จ");
  if (!invoice) notFound();
  const [items, slips, events] = await Promise.all([
    db.from("invoice_items").select("*").eq("invoice_id", id).order("position"),
    db
      .from("payment_submissions")
      .select("*")
      .eq("invoice_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("payment_events")
      .select("*")
      .eq("invoice_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (items.error || slips.error || events.error)
    throw new Error("โหลดรายละเอียดบิลไม่สำเร็จ");
  const signed = await Promise.all(
    (slips.data || []).map(async (s) => {
      const { data, error } = await db.storage
        .from("slips")
        .createSignedUrl(s.path, 600);
      if (error) throw new Error("เปิดสลิปไม่สำเร็จ");
      return { id: s.id, created_at: s.created_at, url: data.signedUrl };
    }),
  );
  return (
    <OwnerAccess subscription={await readSubscription(db, user.id)}>
      <InvoiceDetail
        invoice={invoice}
        back={safeReturnTo(returnTo) || `/dashboard?tab=billing&month=${invoice.month.slice(0, 7)}&step=${invoice.status === "draft" ? "bills" : "share"}`}
        paymentQrUrl={await paymentQrUrl(db, user.id, invoice.property_id)}
        items={items.data || []}
        slips={signed}
        events={events.data || []}
      />
    </OwnerAccess>
  );
}
