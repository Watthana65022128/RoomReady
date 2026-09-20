"use client";
import { useActionState } from "react";
import { requestPlan, approvePlan } from "@/app/subscription/actions";
import { PLANS, type Plan } from "@/lib/plans";
export function RequestPlan({ pendingPlan }: { pendingPlan?: Plan }) {
  const [state, action, busy] = useActionState(requestPlan, { message: "" });
  return (
    <form action={action} className="stack">
      <label>
        เลือกแพ็กเกจ
        <select name="plan" defaultValue={pendingPlan || "starter"}>
          {Object.entries(PLANS).map(([id, p]) => (
            <option value={id} key={id}>
              {p.name} · {p.price} บาท/เดือน · {p.rooms} ห้อง
            </option>
          ))}
        </select>
      </label>
      <p className="hint">
        ส่งคำขอเพื่อให้แอดมินประสานการชำระเงินนอกระบบ ไม่มีการตัดเงินอัตโนมัติ
        หากเปลี่ยนแพ็กเกจที่ขอ คำขอเดิมจะถูกแทนที่
      </p>
      <button className="primary" disabled={busy}>
        {busy
          ? "กำลังส่ง…"
          : pendingPlan
            ? "อัปเดตคำขอแพ็กเกจ"
            : "ขอเปิดใช้ / ต่ออายุแพ็กเกจ"}
      </button>
      <p role="status" className={state.ok ? "success" : "error"}>
        {state.message}
      </p>
    </form>
  );
}
export function ApprovePlan({
  requestId,
  requestedPlan,
}: {
  requestId: string;
  requestedPlan: Plan;
}) {
  const [state, action, busy] = useActionState(approvePlan, { message: "" });
  return (
    <form action={action} className="stack">
      <input type="hidden" name="request_id" value={requestId} />
      <label>
        แพ็กเกจที่จะเปิดใช้
        <select name="plan" defaultValue={requestedPlan}>
          {Object.entries(PLANS).map(([id, p]) => (
            <option key={id} value={id}>
              {p.name} · {p.price} บาท/เดือน · {p.rooms} ห้อง
            </option>
          ))}
        </select>
      </label>
      <label className="payment-confirmation">
        <input type="checkbox" name="payment_confirmed" value="yes" required />{" "}
        ตรวจสอบการรับชำระเงินแล้ว
      </label>
      <button className="primary" disabled={busy}>
        {busy ? "กำลังยืนยัน…" : "ยืนยันสิทธิ์ 1 เดือน"}
      </button>
      <p role="status" className={state.ok ? "success" : "error"}>
        {state.message}
      </p>
    </form>
  );
}
