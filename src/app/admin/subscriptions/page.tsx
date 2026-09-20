import Link from "next/link";
import { notFound } from "next/navigation";
import { owner } from "@/lib/data";
import { ApprovePlan } from "@/components/subscription-forms";
import {
  PLANS,
  subscriptionAccess,
  type Subscription,
  type Plan,
} from "@/lib/plans";
import { dateLabel } from "@/lib/domain";
export const dynamic = "force-dynamic";
type Entry = Subscription & {
  email: string;
  room_count: number;
  property_count: number;
  request_id: string | null;
  requested_plan: Plan | null;
  requested_at: string | null;
  history: {
    plan: Plan;
    expires_at: string;
    created_at: string;
    actor_email: string;
  }[];
};
export default async function AdminSubscriptions({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { db } = await owner();
  const { data: admin, error: adminError } = await db.rpc(
    "is_subscription_admin",
  );
  if (adminError) throw new Error("ตรวจสิทธิ์แอดมินไม่สำเร็จ");
  if (!admin) notFound();
  const params = await searchParams,
    search = (params.q || "").slice(0, 254);
  const page = Math.max(
    0,
    Math.min(100000, Math.floor(Number(params.page) || 0)),
  );
  const { data, error } = await db.rpc("subscription_admin", {
    search,
    page_offset: page * 30,
  });
  if (error) throw new Error("โหลดรายการผู้ใช้ไม่สำเร็จ");
  const entries = data as unknown as Entry[];
  return (
    <main className="subscription-page">
      <Link href="/subscription">← กลับแพ็กเกจของฉัน</Link>
      <h1>จัดการสิทธิ์ผู้ใช้</h1>
      <p>
        ยืนยันหลังตรวจสอบการรับชำระเงินนอกระบบแล้วเท่านั้น
        ทุกครั้งบันทึกผู้ยืนยันและวันหมดอายุ
      </p>
      <form className="admin-search">
        <label>
          ค้นหาอีเมลหรือรหัสเจ้าของ
          <input name="q" defaultValue={search} maxLength={254} />
        </label>
        <button className="primary">ค้นหา</button>
      </form>
      <p className="hint">แสดงหน้าละ 30 บัญชี เรียงคำขอที่รอยืนยันก่อน</p>
      <div className="admin-owners">
        {entries.map((e) => {
          const access = subscriptionAccess(e);
          return (
            <article className="panel admin-owner" key={e.owner_id}>
              <div>
                <h2>{e.email}</h2>
                <small className="muted">{e.owner_id}</small>
                <p>
                  {e.plan === "trial" ? "ทดลองฟรี" : PLANS[e.plan].name} ·{" "}
                  {e.room_count}/{access.limit} ห้อง · {e.property_count} หอ
                </p>
                <p>
                  {access.active ? "ใช้ได้ถึง" : "หมดสิทธิ์"}{" "}
                  {access.end ? dateLabel(access.end) : "—"}
                </p>
                <details>
                  <summary>ประวัติยืนยันล่าสุด</summary>
                  {e.history.length ? (
                    e.history.map((h, i) => (
                      <p key={i}>
                        {dateLabel(h.created_at)} · {PLANS[h.plan].name} · ถึง{" "}
                        {dateLabel(h.expires_at)} · โดย {h.actor_email}
                      </p>
                    ))
                  ) : (
                    <p>ยังไม่มีประวัติ</p>
                  )}
                </details>
              </div>
              <div>
                {e.request_id && e.requested_plan ? (
                  <>
                    <p className="notice">
                      ขอ {PLANS[e.requested_plan].name} ·{" "}
                      {e.requested_at && dateLabel(e.requested_at)}
                    </p>
                    <ApprovePlan
                      requestId={e.request_id}
                      requestedPlan={e.requested_plan}
                    />
                  </>
                ) : (
                  <p className="muted">ไม่มีคำขอที่รอยืนยัน</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!entries.length && <p>ไม่พบบัญชีที่ตรงกับการค้นหา</p>}
      <nav className="subscription-nav" aria-label="หน้ารายการ">
        {page > 0 && (
          <Link href={`?q=${encodeURIComponent(search)}&page=${page - 1}`}>
            ← ก่อนหน้า
          </Link>
        )}
        {entries.length === 30 && (
          <Link href={`?q=${encodeURIComponent(search)}&page=${page + 1}`}>
            ถัดไป →
          </Link>
        )}
      </nav>
    </main>
  );
}
