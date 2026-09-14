"use client";
import { useActionState } from "react";
import Link from "next/link";
import { authAction } from "@/app/actions";
export function AuthForm({ mode, error }: { mode: string; error?: string }) {
  const [state, action, pending] = useActionState(authAction.bind(null, mode), {
    message: "",
  });
  const title = (
    {
      login: "ยินดีต้อนรับกลับ",
      signup: "เริ่มจัดการหอของคุณ",
      forgot: "ลืมรหัสผ่าน",
      reset: "ตั้งรหัสผ่านใหม่",
    } as Record<string, string>
  )[mode];
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link href="/login" className="brand">
          <span className="brand-icon">ห</span>หอพร้อม
          <span className="brand-en">HORPROM</span>
        </Link>
        <div>
          <span className="eyebrow">ทุกห้อง อยู่ในมือคุณ</span>
          <h1>
            ปิดรอบบิล
            <br />
            เปิดเวลาให้ชีวิต
          </h1>
          <p>
            มิเตอร์ บิล และยอดรับชำระ
            <br />
            จัดการครบในที่เดียว
          </p>
        </div>
        <div className="story-ledger">
          <span>01 / กรอกมิเตอร์</span>
          <span>02 / ออกบิล</span>
          <span>03 / รับชำระ</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow">สำหรับเจ้าของหอพัก</span>
          <h2>{title}</h2>
          <p className="muted">จัดการหอพักของคุณได้จากทุกอุปกรณ์</p>
          <form action={action} className="stack">
            {mode !== "reset" && (
              <label>
                อีเมล
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label>
                รหัสผ่าน
                <input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
              </label>
            )}
            <p role="status" className={state.ok ? "success" : "error"}>
              {state.message ||
                (error ? "ลิงก์หมดอายุหรือใช้งานแล้ว กรุณาขอใหม่" : "")}
            </p>
            <button className="primary" disabled={pending}>
              {pending
                ? "กำลังดำเนินการ…"
                : mode === "login"
                  ? "เข้าสู่ระบบ"
                  : mode === "signup"
                    ? "สร้างบัญชี"
                    : mode === "forgot"
                      ? "ส่งลิงก์ตั้งรหัสผ่าน"
                      : "บันทึกรหัสผ่าน"}
            </button>
          </form>
          <div className="auth-links">
            {mode === "login" ? (
              <>
                <Link href="/forgot-password">ลืมรหัสผ่าน?</Link>
                <Link href="/signup">สร้างบัญชีใหม่ →</Link>
              </>
            ) : (
              <Link href="/login">← กลับเข้าสู่ระบบ</Link>
            )}
          </div>
        </div>
        <p className="auth-footer">หอพร้อม · งานหอพักที่เบาขึ้นทุกเดือน</p>
      </section>
    </main>
  );
}
