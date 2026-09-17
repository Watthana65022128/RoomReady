import type { PublicBill, GroupPublicBill } from "@/lib/domain";
import { money, dateLabel, monthLabel } from "@/lib/domain";
import { Badge } from "./ui";
import { SlipUpload } from "./slip-upload";
import { PaymentQr } from "./payment-qr";
import { RoomPaymentNotice } from "./room-payment-notice";
export function TenantBill({
  bill,
  token,
  uploadUrl,
  group = false,
}: {
  bill: PublicBill | GroupPublicBill;
  token?: string;
  uploadUrl?: string;
  group?: boolean;
}) {
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
            {monthLabel(bill.month)}
            {"tenant_name" in bill ? " · " + bill.tenant_name : ""}
          </p>
          {group ? (
            <span className={"badge " + bill.status}>
              {bill.status === "paid"
                ? "ชำระแล้ว"
                : bill.status === "slip_submitted"
                  ? "รอตรวจสอบ"
                  : "รอชำระ"}
            </span>
          ) : (
            <Badge invoice={bill} />
          )}
        </header>
        {group && <RoomPaymentNotice />}
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
        {(!group || bill.status !== "paid") && (
          <div className="payment-info">
            <span className="eyebrow">โอนเงินเข้าบัญชี</span>
            <p>{bill.payment_info}</p>
            <PaymentQr key={bill.payment_qr_url} url={bill.payment_qr_url} />
          </div>
        )}
        {bill.status === "paid" ? (
          <div className="paid-confirmation">
            <h2>รับชำระเรียบร้อยแล้ว ✓</h2>
            <p>เจ้าของหอยืนยัน {bill.paid_at ? dateLabel(bill.paid_at) : ""}</p>
          </div>
        ) : (
          <SlipUpload
            token={token}
            uploadUrl={uploadUrl}
            roomName={group ? bill.room_name : undefined}
            submitted={bill.status === "slip_submitted"}
          />
        )}
      </article>
      <p className="tenant-footer">
        {group
          ? "กรุณาชำระและส่งสลิปเฉพาะห้องของตนเอง"
          : "ลิงก์นี้เป็นข้อมูลส่วนตัวของคุณ กรุณาไม่ส่งต่อให้ผู้อื่น"}
        <br />
        หากยอดไม่ถูกต้อง โปรดติดต่อเจ้าของหอพัก
      </p>
    </main>
  );
}
