"use client";
import { useActionState, useEffect, useState, type ComponentProps } from "react";
import Link from "next/link";
import { authAction } from "@/app/actions";
import { useToast } from "./toast";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isStrongPassword,
  isValidEmail,
  passwordChecks,
} from "@/lib/auth-validation";
export function AuthForm({ mode, error }: { mode: string; error?: string }) {
  const [state, action, pending] = useActionState(authAction.bind(null, mode), {
    message: "",
  });
  const notify = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const signup = mode === "signup";
  const checks = passwordChecks(password);
  const signupValid =
    !signup ||
    (isValidEmail(email) &&
      isStrongPassword(password) &&
      password === confirmation);
  useEffect(() => {
    if (state.message) notify(state.message, state.ok ? "success" : "error");
  }, [state, notify]);
  const title = (
    {
      login: "ยินดีต้อนรับ",
      signup: "เริ่มจัดการหอของคุณ",
      forgot: "ลืมรหัสผ่าน",
      reset: "ตั้งรหัสผ่านใหม่",
    } as Record<string, string>
  )[mode];
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link href="/login" className="brand">
          <span className="brand-icon">R</span>RoomReady
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
                  maxLength={254}
                  onChange={(event) => setEmail(event.target.value.trim())}
                  placeholder="you@example.com"
                />
                {signup && email && !isValidEmail(email) && (
                  <small className="field-error">รูปแบบอีเมลหรือโดเมนไม่ถูกต้อง</small>
                )}
              </label>
            )}
            {mode !== "forgot" && (
              <label>
                รหัสผ่าน
                <PasswordInput
                  name="password"
                  required
                  minLength={signup ? PASSWORD_MIN_LENGTH : 8}
                  maxLength={signup ? PASSWORD_MAX_LENGTH : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
              </label>
            )}
            {signup && (
              <>
                <ul className="password-rules" aria-label="เงื่อนไขรหัสผ่าน">
                  <li className={checks.length ? "valid" : ""}>8–72 ตัวอักษร</li>
                  <li className={checks.lowercase ? "valid" : ""}>ตัวพิมพ์เล็ก</li>
                  <li className={checks.uppercase ? "valid" : ""}>ตัวพิมพ์ใหญ่</li>
                  <li className={checks.number ? "valid" : ""}>ตัวเลข</li>
                  <li className={checks.symbol ? "valid" : ""}>สัญลักษณ์</li>
                </ul>
                <label>
                  ยืนยันรหัสผ่าน
                  <PasswordInput
                    name="confirm_password"
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    maxLength={PASSWORD_MAX_LENGTH}
                    autoComplete="new-password"
                    onChange={(event) => setConfirmation(event.target.value)}
                    aria-invalid={Boolean(confirmation && password !== confirmation)}
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                  />
                  {confirmation && password !== confirmation && (
                    <small className="field-error">รหัสผ่านไม่ตรงกัน</small>
                  )}
                </label>
              </>
            )}
            <p role="status" className={state.ok ? "success" : "error"}>
              {state.message ||
                (error ? "ลิงก์หมดอายุหรือใช้งานแล้ว กรุณาขอใหม่" : "")}
            </p>
            <button className="primary" disabled={pending || !signupValid}>
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
                <Link href="/signup">สร้างบัญชีใหม่</Link>
              </>
            ) : (
              <Link href="/login">กลับเข้าสู่ระบบ</Link>
            )}
          </div>
        </div>
        <p className="auth-footer">RoomReady · งานหอพักที่เบาขึ้นทุกเดือน</p>
      </section>
    </main>
  );
}

function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const [revealed, setRevealed] = useState(false);
  const label = props.name === "confirm_password" ? "รหัสผ่านยืนยัน" : "รหัสผ่าน";
  return (
    <span className="password-input">
      <input {...props} type={revealed ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        aria-label={`แสดง${label}`}
        aria-pressed={revealed}
        title={`${revealed ? "ซ่อน" : "แสดง"}${label}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setRevealed((value) => !value)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {revealed && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </span>
  );
}
