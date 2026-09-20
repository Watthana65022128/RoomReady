import Link from "next/link";
import { subscriptionContext } from "@/lib/subscription";
import { PLANS, subscriptionAccess } from "@/lib/plans";
import { dateLabel } from "@/lib/domain";
import { RequestPlan } from "@/components/subscription-forms";
export const dynamic = "force-dynamic";
export default async function SubscriptionPage() {
  const { db, user, subscription: sub } = await subscriptionContext();
  const access = subscriptionAccess(sub);
  const [request, admin] = await Promise.all([
    db
      .from("subscription_requests")
      .select("*")
      .eq("owner_id", user.id)
      .eq("status", "pending")
      .maybeSingle(),
    db.rpc("is_subscription_admin"),
  ]);
  if (request.error || admin.error)
    throw new Error("โหลดสิทธิ์ใช้งานไม่สำเร็จ");
  return (
    <main className="subscription-page">
      <nav className="subscription-nav">
        <Link href="/dashboard">← กลับหน้าจัดการ</Link>
        {admin.data && (
          <Link href="/admin/subscriptions">จัดการสิทธิ์ผู้ใช้ ↗</Link>
        )}
      </nav>
      <span className="eyebrow">ROOMREADY / MEMBERSHIP</span>
      <h1>แพ็กเกจที่พอดีกับหอคุณ</h1>
      <p>1 บัญชี · 1 หอพัก · ฟีเจอร์ครบทุกแพ็กเกจ ต่างกันที่จำนวนห้อง</p>
      <section
        className={`subscription-banner ${access.active ? "" : "expired"}`}
      >
        <div>
          <h2>
            {access.trial
              ? "ทดลองฟรี 30 วัน"
              : PLANS[sub.plan as keyof typeof PLANS].name}
          </h2>
          <p>
            {access.active ? "ใช้งานได้ถึง" : "สิทธิ์หมดอายุเมื่อ"}{" "}
            {access.end ? dateLabel(access.end) : "—"}
          </p>
          <p>
            ใช้แล้ว {sub.room_count} / {access.limit} ห้อง ·{" "}
            {sub.property_count} หอพัก
          </p>
          {!access.active && (
            <p>ดูข้อมูลเดิมได้ บันทึกข้อมูลต่อได้เมื่อแอดมินยืนยันแพ็กเกจ</p>
          )}
          {sub.room_count > access.limit && (
            <p>ข้อมูลเดิมยังอยู่ครบ แต่เพิ่มห้องไม่ได้จนจำนวนต่ำกว่าโควตา</p>
          )}
        </div>
      </section>
      <div className="plan-grid">
        {Object.entries(PLANS).map(([id, p]) => (
          <article className="plan-card" key={id}>
            <h2>{p.name}</h2>
            <p className="plan-price">
              {p.price}
              <small> บาท/เดือน</small>
            </p>
            <p>
              ไม่เกิน <strong>{p.rooms} ห้อง</strong>
            </p>
            <p className="hint">1 หอพักต่อบัญชี</p>
          </article>
        ))}
      </div>
      <section className="panel subscription-request">
        <h2>เปิดใช้หรือเปลี่ยนแพ็กเกจ</h2>
        {request.data && (
          <p className="notice">
            รอยืนยัน: {PLANS[request.data.plan].name} · ส่งเมื่อ{" "}
            {dateLabel(request.data.created_at)}
          </p>
        )}
        <RequestPlan pendingPlan={request.data?.plan} />
        <p className="hint">
          ต่ออายุแพ็กเกจเดิมก่อนหมดอายุจะนับต่อจากวันเดิม
          เปลี่ยนแพ็กเกจจะเริ่มรอบใหม่ 1 เดือน
          ไม่มีการคำนวณเงินส่วนต่างอัตโนมัติ
        </p>
      </section>
    </main>
  );
}
