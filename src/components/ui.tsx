"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { billStatus, statusText } from "@/lib/domain";
import type { Tables, Json } from "@/types/database";
import { command } from "@/app/actions";
import { useToast } from "./toast";
export function Badge({
  invoice,
}: {
  invoice: Pick<Tables<"invoices">, "status" | "due_date">;
}) {
  const s = billStatus(invoice);
  return <span className={"badge " + s}>{statusText[s]}</span>;
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose}>
      <header className="modal-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="ปิด"
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  name,
  value = "",
  type = "text",
  required = false,
  placeholder,
  step,
  min,
  max,
}: {
  label: string;
  name: string;
  value?: string | number | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        defaultValue={value ?? ""}
        type={type}
        required={required}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        maxLength={type === "text" ? 160 : undefined}
      />
    </label>
  );
}
export function CommandForm({
  op,
  build,
  onDone,
  children,
  label = "บันทึก",
}: {
  op: string;
  build: (f: FormData) => Json;
  onDone?: () => void;
  children: ReactNode;
  label?: string;
}) {
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const notify = useToast();
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setPending(true);
        setMessage("");
        try {
          const r = await command(op, build(f));
          setMessage(r.message);
          notify(r.message, r.ok ? "success" : "error");
          if (r.ok) onDone?.();
        } catch {
          setMessage("เชื่อมต่อไม่สำเร็จ ลองบันทึกอีกครั้ง");
          notify("เชื่อมต่อไม่สำเร็จ ลองบันทึกอีกครั้ง", "error");
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending}>{children}</fieldset>
      <p role="status" className="error">
        {message}
      </p>
      <button className="primary" disabled={pending}>
        {pending ? "กำลังบันทึก…" : label}
      </button>
    </form>
  );
}
export const fields = (f: FormData) =>
  Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol">▤</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function ShareBill({
  token,
  room,
  total,
}: {
  token: string;
  room: string;
  total: string;
}) {
  const [message, setMessage] = useState("");
  const notify = useToast();
  async function share() {
    const url = window.location.origin + "/b/" + token;
    const text = `บิลห้อง ${room} ยอด ${total} บาท เปิดดูรายละเอียดและส่งสลิปได้ที่`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "บิลห้อง " + room, text, url });
        setMessage("เปิดเมนูแชร์แล้ว");
      } else {
        await navigator.clipboard.writeText(text + "\n" + url);
        setMessage("คัดลอกแล้ว นำไปวางใน LINE");
        notify("คัดลอกลิงก์แล้ว นำไปวางใน LINE ได้เลย", "success");
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text + "\n" + url);
        setMessage("คัดลอกแล้ว นำไปวางใน LINE");
        notify("คัดลอกลิงก์แล้ว นำไปวางใน LINE ได้เลย", "success");
      } catch {
        setMessage("คัดลอกลิงก์จากหน้าบิลเพื่อส่งใน LINE");
        notify("คัดลอกไม่สำเร็จ กรุณาคัดลอกลิงก์จากหน้าบิล", "error");
      }
    }
  }
  return (
    <span className="share-wrap">
      <button type="button" className="small secondary" onClick={share}>
        แชร์บิล ↗
      </button>
      {message && <small role="status">{message}</small>}
    </span>
  );
}
