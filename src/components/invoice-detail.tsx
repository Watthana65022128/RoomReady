"use client";
import { useOwnerAccess } from "./owner-access";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { PaymentQr } from "./payment-qr";
import type { Json, Tables } from "@/types/database";
import { money, dateLabel, monthLabel, lineTotal } from "@/lib/domain";
import { Badge, ShareBill, Modal, CommandForm, Field } from "./ui";
export function InvoiceDetail({
  invoice: i,
  items,
  slips,
  events,
  paymentQrUrl,
}: {
  invoice: Tables<"invoices">;
  items: Tables<"invoice_items">[];
  slips: { id: string; created_at: string; url: string }[];
  events: Tables<"payment_events">[];
  paymentQrUrl?: string | null;
}) {
  const canWrite = useOwnerAccess();
  const router = useRouter(),
    [modal, setModal] = useState(""),
    [editItems, setItems] = useState(items.map((x) => ({ ...x })));
  const back =
    "/dashboard?tab=billing&property=" +
    i.property_id +
    "&month=" +
    i.month.slice(0, 7);
  const done = () => {
    setModal("");
    router.refresh();
  };
  return (
    <main className="detail-page">
      <header className="detail-nav">
        <Link href={back}>← กลับรอบบิล</Link>
        <span className="brand">RoomReady</span>
      </header>
      {!canWrite && (
        <p className="notice">
          สิทธิ์หมดอายุแล้ว ดูบิลเดิมได้{" "}
          <Link href="/subscription">ขอเปิดใช้แพ็กเกจ →</Link>
        </p>
      )}
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {i.property_name} / {monthLabel(i.month)}
          </span>
          <h1>บิลห้อง {i.room_name}</h1>
          <p>{i.tenant_name}</p>
        </div>
        <Badge invoice={i} />
      </div>
      <div className="detail-grid">
        <section className="panel invoice-paper">
          <div className="invoice-total">
            <span>ยอดชำระทั้งหมด</span>
            <strong>฿{money(i.total)}</strong>
            <p>ครบกำหนด {dateLabel(i.due_date)}</p>
          </div>
          <div className="invoice-lines">
            {items.map((item) => (
              <div key={item.id}>
                <span>
                  <b>{item.label}</b>
                  <small>
                    {item.previous_reading !== null &&
                    item.current_reading !== null
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
            <span className="eyebrow">ข้อมูลรับเงิน</span>
            <p>{i.payment_info}</p>
            <PaymentQr key={paymentQrUrl} url={paymentQrUrl} />
          </div>
          <div className="actions wrap padded">
            {i.status === "draft" ? (
              <>
                <button
                  className="primary"
                  disabled={!canWrite}
                  onClick={() => setModal("edit")}
                >
                  แก้ไขบิลร่าง
                </button>
                <button
                  className="secondary"
                  disabled={!canWrite}
                  onClick={() => setModal("delete")}
                >
                  ลบร่างเพื่อแก้มิเตอร์
                </button>
              </>
            ) : (
              <>
                <Link
                  className="secondary"
                  target="_blank"
                  href={"/b/" + i.token}
                >
                  เปิดบิลผู้เช่า ↗
                </Link>
                {i.status !== "void" && (
                  <ShareBill
                    token={i.token}
                    room={i.room_name}
                    total={money(i.total)}
                  />
                )}
              </>
            )}
          </div>
        </section>
        <aside className="stack">
          <section className="panel padded">
            <h2>การชำระเงิน</h2>
            {i.status === "paid" ? (
              <>
                <p className="success">
                  ยืนยันรับเงิน {i.paid_at ? dateLabel(i.paid_at) : ""}
                </p>
                <p>{i.payment_method === "cash" ? "รับเงินสด" : "โอนเงิน"}</p>
                <button
                  className="danger-button"
                  disabled={!canWrite}
                  onClick={() => setModal("revoke")}
                >
                  ยกเลิกการรับเงิน
                </button>
              </>
            ) : !["draft", "void"].includes(i.status) ? (
              <>
                <p className="muted">ตรวจยอดโอนและชื่อบัญชีก่อนยืนยัน</p>
                <div className="stack">
                  <button
                    className="primary"
                    disabled={!canWrite}
                    onClick={() => setModal("transfer")}
                  >
                    ยืนยันรับเงินโอน
                  </button>
                  <button
                    className="secondary"
                    disabled={!canWrite}
                    onClick={() => setModal("cash")}
                  >
                    บันทึกรับเงินสด
                  </button>
                  <button
                    className="text-button text-danger"
                    disabled={!canWrite}
                    onClick={() => setModal("void")}
                  >
                    ยกเลิกบิล
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">
                {i.status === "draft"
                  ? "ออกบิลจากหน้ารอบบิลก่อนรับชำระ"
                  : "บิลนี้ถูกยกเลิกแล้ว"}
              </p>
            )}
          </section>
          <section className="panel padded">
            <h2>สลิปจากผู้เช่า</h2>
            {slips.length === 0 ? (
              <p className="muted">ยังไม่มีสลิป</p>
            ) : (
              slips.map((s, index) => (
                <div className="slip-preview" key={s.id}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    <Image
                      unoptimized
                      width={600}
                      height={900}
                      src={s.url}
                      alt={"สลิป " + (index === 0 ? "ล่าสุด" : index + 1)}
                    />
                  </a>
                  <small>
                    {index === 0 ? "ล่าสุด · " : ""}
                    {dateLabel(s.created_at)}
                  </small>
                </div>
              ))
            )}
          </section>
          {i.status !== "draft" && i.status !== "void" && (
            <button
              className="text-button"
              disabled={!canWrite}
              onClick={() => setModal("renew")}
            >
              ออกลิงก์ใหม่ / เพิกถอนลิงก์เดิม
            </button>
          )}
        </aside>
      </div>
      <section className="panel padded history">
        <h2>ประวัติรายการ</h2>
        {events.length === 0 ? (
          <p className="muted">ยังไม่มีรายการชำระเงิน</p>
        ) : (
          events.map((e) => (
            <div className="history-row" key={e.id}>
              <span>
                {(
                  {
                    confirmed: "ยืนยันรับเงิน",
                    revoked: "ยกเลิกการรับเงิน",
                    void: "ยกเลิกบิล",
                    slip_submitted: "ผู้เช่าส่งสลิป",
                  } as Record<string, string>
                )[e.event] || e.event}
                <small>
                  {e.note === "cash"
                    ? "เงินสด"
                    : e.note === "transfer"
                      ? "โอนเงิน"
                      : e.note}
                  {e.actor_id ? " · เจ้าของหอ" : ""}
                </small>
              </span>
              <span>
                {dateLabel(e.created_at)}{" "}
                {e.amount !== 0 && " · ฿" + money(e.amount)}
              </span>
            </div>
          ))
        )}
      </section>
      {modal === "edit" && (
        <Modal title="แก้ไขบิลร่าง" onClose={() => setModal("")}>
          <CommandForm
            op="invoice_edit"
            onDone={done}
            build={(f) => ({
              id: i.id,
              due_date: String(f.get("due_date")),
              items: editItems.map(
                ({
                  label,
                  kind,
                  quantity,
                  rate,
                  previous_reading,
                  current_reading,
                }) => ({
                  label,
                  kind,
                  quantity,
                  rate,
                  previous_reading,
                  current_reading,
                }),
              ) as Json,
            })}
          >
            <Field
              name="due_date"
              label="วันครบกำหนด"
              type="date"
              value={i.due_date}
              required
            />
            <div className="edit-items">
              {editItems.map((item, index) => (
                <div key={index} className="edit-line">
                  <label>
                    รายการ
                    <input
                      required
                      value={item.label}
                      onChange={(e) =>
                        setItems(
                          editItems.map((it, j) =>
                            j === index ? { ...it, label: e.target.value } : it,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    จำนวน
                    <input
                      required
                      type="number"
                      min="0"
                      max="999999"
                      step="0.001"
                      value={item.quantity}
                      onChange={(e) =>
                        setItems(
                          editItems.map((it, j) =>
                            j === index
                              ? {
                                  ...it,
                                  quantity: Number(e.target.value),
                                  previous_reading: null,
                                  current_reading: null,
                                }
                              : it,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    บาท / หน่วย
                    <input
                      required
                      type="number"
                      min="0"
                      max="999999"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) =>
                        setItems(
                          editItems.map((it, j) =>
                            j === index
                              ? { ...it, rate: Number(e.target.value) }
                              : it,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={"ลบ " + item.label}
                    onClick={() =>
                      setItems(editItems.filter((_, j) => j !== index))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setItems([
                  ...editItems,
                  {
                    ...items[0],
                    label: "ค่าใช้จ่ายอื่น",
                    kind: "other",
                    quantity: 1,
                    rate: 0,
                    previous_reading: null,
                    current_reading: null,
                  },
                ])
              }
            >
              + เพิ่มรายการ
            </button>
            <p>
              รวม ฿
              {money(
                editItems.reduce(
                  (s, it) => s + lineTotal(it.quantity, it.rate),
                  0,
                ),
              )}
            </p>
          </CommandForm>
        </Modal>
      )}
      {modal && modal !== "edit" && (
        <Modal
          title={
            modal === "revoke"
              ? "ยกเลิกการรับเงิน"
              : modal === "void"
                ? "ยกเลิกบิล"
                : modal === "delete"
                  ? "ลบบิลร่าง"
                  : modal === "renew"
                    ? "สร้างลิงก์ใหม่"
                    : "ยืนยันรับเงิน " + (modal === "cash" ? "สด" : "โอน")
          }
          onClose={() => setModal("")}
        >
          <p>
            {modal === "renew"
              ? "ลิงก์เดิมจะใช้ไม่ได้ คุณต้องส่งลิงก์ใหม่ให้ผู้เช่า"
              : modal === "delete"
                ? "ร่างนี้จะถูกลบเพื่อให้แก้มิเตอร์และสร้างบิลใหม่ได้"
                : modal === "void"
                  ? "บิลและลิงก์นี้จะถูกยกเลิก ประวัติยังคงอยู่"
                  : `ห้อง ${i.room_name} · ${i.tenant_name} · ฿${money(i.total)}`}
          </p>
          <CommandForm
            op={
              modal === "revoke"
                ? "payment_revoke"
                : modal === "void"
                  ? "invoice_void"
                  : modal === "delete"
                    ? "draft_delete"
                    : modal === "renew"
                      ? "link_renew"
                      : "payment_confirm"
            }
            build={(f) => ({
              id: i.id,
              method: modal,
              note: String(f.get("note") || ""),
            })}
            onDone={() => {
              if (modal === "delete") router.push(back);
              else done();
            }}
            label="ยืนยัน"
          >
            {["revoke", "void"].includes(modal) && (
              <Field name="note" label="เหตุผล" required />
            )}
          </CommandForm>
        </Modal>
      )}
    </main>
  );
}
