"use client";
import { useState } from "react";
import { propertyBillLink } from "@/app/group-bill-actions";
import { Modal } from "./ui";

export function SharePropertyBills({
  propertyId,
  name,
}: {
  propertyId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmRotate, setConfirmRotate] = useState(false);
  const text = `บิลของ ${name} พร้อมตรวจสอบแล้ว กรุณาเลือกเดือนและห้องของตนเองเพื่อดูยอด ชำระเงิน และส่งสลิป\nกรุณาชำระเฉพาะห้องของตนเอง ตรวจสอบเลขห้องและยอดเงินก่อนโอน\n${url}`;
  async function prepare(rotate = false) {
    setOpen(true);
    setBusy(true);
    setMessage("");
    try {
      const token = await propertyBillLink(propertyId, rotate);
      setUrl(window.location.origin + "/h/" + token);
      setConfirmRotate(false);
      if (rotate)
        setMessage("เปลี่ยนลิงก์แล้ว ลิงก์เก่าหยุดใช้งาน กรุณาแชร์ลิงก์ใหม่");
    } catch {
      setMessage("เตรียมลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="primary" onClick={() => prepare()}>
        แชร์บิลลงกลุ่ม ↗
      </button>
      {open && (
        <Modal
          title="แชร์บิลทั้งหอ"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div className="stack">
            <p>ลิงก์เดียวใช้ได้ทุกเดือน เปิดมาที่รอบบิลล่าสุดที่ออกแล้ว</p>
            <p className="hint">
              ผู้มีลิงก์สามารถดูยอดและสถานะของทุกห้องได้
              โดยไม่แสดงชื่อผู้เช่าหรือรูปสลิป
            </p>
            {url && (
              <>
                <label>
                  ข้อความสำหรับวางในกลุ่ม LINE
                  <textarea
                    readOnly
                    rows={6}
                    value={text}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </label>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(text);
                      setMessage("คัดลอกแล้ว นำไปวางในกลุ่ม LINE ได้เลย");
                    } catch {
                      setMessage("กรุณาเลือกข้อความด้านบนแล้วคัดลอกด้วยตนเอง");
                    }
                  }}
                >
                  คัดลอกข้อความและลิงก์
                </button>
                <a href={url} target="_blank" rel="noreferrer">
                  เปิดดูหน้าลูกหอ ↗
                </a>
                {confirmRotate ? (
                  <div className="stack">
                    <p>ลิงก์เดิมจะเปิดไม่ได้ และต้องส่งลิงก์ใหม่ให้ลูกหอ</p>
                    <div className="actions wrap">
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => prepare(true)}
                      >
                        ยืนยันเปลี่ยนลิงก์
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => setConfirmRotate(false)}
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => setConfirmRotate(true)}
                  >
                    เปลี่ยนลิงก์รวม
                  </button>
                )}
              </>
            )}
            {!url && !busy && (
              <button className="secondary" onClick={() => prepare()}>
                ลองอีกครั้ง
              </button>
            )}
            <p role="status">{busy ? "กำลังเตรียมลิงก์…" : message}</p>
          </div>
        </Modal>
      )}
    </>
  );
}
