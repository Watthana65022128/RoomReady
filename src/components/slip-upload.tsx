"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast";
export function SlipUpload({
  token,
  submitted,
}: {
  token: string;
  submitted: boolean;
}) {
  const router = useRouter(),
    ref = useRef<HTMLInputElement>(null);
  const notify = useToast();
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [message, setMessage] = useState(""),
    [fileName, setName] = useState("");
  return (
    <form
      className="slip-upload stack"
      onSubmit={(e) => {
        e.preventDefault();
        const file = ref.current?.files?.[0];
        if (!file) return;
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5242880 ||
          !file.size
        ) {
          setMessage("กรุณาเลือก JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB");
          notify("กรุณาเลือก JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB", "error");
          return;
        }
        setBusy(true);
        setMessage("");
        setProgress(0);
        const form = new FormData();
        form.append("file", file);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/b/" + token + "/slip");
        xhr.timeout = 60000;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onerror = xhr.ontimeout = () => {
          setBusy(false);
          setMessage("การเชื่อมต่อขัดข้อง ลองส่งอีกครั้ง");
          notify("การเชื่อมต่อขัดข้อง ลองส่งอีกครั้ง", "error");
        };
        xhr.onload = () => {
          setBusy(false);
          try {
            const result = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              setMessage("ส่งสลิปแล้ว รอเจ้าของตรวจสอบ");
              notify("ส่งสลิปแล้ว รอเจ้าของตรวจสอบ", "success");
              setName("");
              if (ref.current) ref.current.value = "";
              router.refresh();
            } else {
              setMessage(result.error || "ส่งไม่สำเร็จ ลองอีกครั้ง");
              notify(result.error || "ส่งไม่สำเร็จ ลองอีกครั้ง", "error");
            }
          } catch {
            setMessage("ส่งไม่สำเร็จ กรุณาลองอีกครั้ง");
            notify("ส่งไม่สำเร็จ กรุณาลองอีกครั้ง", "error");
          }
        };
        xhr.send(form);
      }}
    >
      <h2>{submitted ? "ได้รับสลิปแล้ว รอตรวจสอบ" : "แจ้งชำระเงิน"}</h2>
      <p className="muted">
        {submitted
          ? "หากส่งผิด คุณสามารถแนบสลิปใหม่ได้จนกว่าเจ้าของจะยืนยัน"
          : "หลังโอนเงิน แนบสลิปเพื่อแจ้งเจ้าของหอพัก"}
      </p>
      <label className="upload-zone">
        <span>↑</span>
        <b>{fileName || "เลือกภาพสลิป"}</b>
        <small>JPG, PNG, WebP · ไม่เกิน 5 MB</small>
        <input
          ref={ref}
          aria-label="เลือกภาพสลิป"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          disabled={busy}
          onChange={(e) => setName(e.target.files?.[0]?.name || "")}
        />
      </label>
      {busy && (
        <>
          <progress value={progress} max="100" />
          <small>
            {progress === 100
              ? "กำลังตรวจและบันทึกสลิป…"
              : `กำลังส่ง ${progress}%`}
          </small>
        </>
      )}
      <p role="status">{message}</p>
      <button className="primary" disabled={busy || !fileName}>
        {busy ? "กำลังส่ง…" : submitted ? "ส่งสลิปใหม่" : "ส่งสลิปแจ้งชำระ"}
      </button>
    </form>
  );
}
