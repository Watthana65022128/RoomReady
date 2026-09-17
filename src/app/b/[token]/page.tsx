import { notFound } from "next/navigation";
import { billGateway } from "@/lib/public-bill";
import type { PublicBill } from "@/lib/domain";
import { money, dateLabel, monthLabel } from "@/lib/domain";
import { Badge } from "@/components/ui";
import { SlipUpload } from "@/components/slip-upload";
import { PaymentQr } from "@/components/payment-qr";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();
  const response = await billGateway(token);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("โหลดบิลไม่สำเร็จ");
  const bill: PublicBill = await response.json();
  return (
    <main className="tenant-page">
      <div className="tenant-brand">
        <span className="brand-icon">R</span>
        <span>RoomReady</span>
      </div>
      <article className="panel tenant-bill">
        <header>
          <span className="eyebrow">{bill.property_name}</span>
          <h1>บิลห้อง {bill.room_name}</h1>
          <p>
            {monthLabel(bill.month)} · {bill.tenant_name}
          </p>
          <Badge invoice={bill} />
        </header>
        <div className="invoice-total">
          <span>ยอดชำระทั้งหมด</span>
          <strong>฿{money(bill.total)}</strong>
          <p>ครบกำหนด {dateLabel(bill.due_date)}</p>
        </div>
        <div className="invoice-lines">
          {bill.items.map((item, index) => (
            <div key={index}>
              <span>
                <b>{item.label}</b>
                <small>
                  {item.previous_reading !== null
                    ? `มิเตอร์ ${item.previous_reading} → ${item.current_reading} · `
                    : ""}
                  {item.quantity} × {money(item.rate)}
                </small>
              </span>
              <strong>{money(item.amount || 0)}</strong>
            </div>
          ))}
        </div>
        <div className="payment-info">
          <span className="eyebrow">โอนเงินเข้าบัญชี</span>
          <p>{bill.payment_info}</p>
          <PaymentQr key={bill.payment_qr_url} url={bill.payment_qr_url} />
        </div>
        {bill.status === "paid" ? (
          <div className="paid-confirmation">
            <h2>รับชำระเรียบร้อยแล้ว ✓</h2>
            <p>เจ้าของหอยืนยัน {bill.paid_at ? dateLabel(bill.paid_at) : ""}</p>
          </div>
        ) : (
          <SlipUpload
            token={token}
            submitted={bill.status === "slip_submitted"}
          />
        )}
      </article>
      <p className="tenant-footer">
        ลิงก์นี้เป็นข้อมูลส่วนตัวของคุณ กรุณาไม่ส่งต่อให้ผู้อื่น
        <br />
        หากยอดไม่ถูกต้อง โปรดติดต่อเจ้าของหอพัก
      </p>
    </main>
  );
}
