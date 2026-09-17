"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  readPaymentQr,
  savePaymentQr,
  removePaymentQr,
} from "@/app/payment-qr-actions";
import { QR_MAX_BYTES } from "@/lib/payment-qr-validation";

export function PaymentQrSettings({ propertyId }: { propertyId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    readPaymentQr(propertyId)
      .then((value) => {
        if (active) setUrl(value);
      })
      .catch(() => {
        if (active) setMessage("โหลดรูป QR ไม่สำเร็จ กรุณาเปิดการตั้งค่าใหม่");
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [propertyId]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  async function save(remove = false) {
    setPending(true);
    setMessage("");
    try {
      const form = new FormData();
      if (file) form.set("file", file);
      const result = remove
        ? await removePaymentQr(propertyId)
        : await savePaymentQr(propertyId, form);
      setMessage(result.message);
      if (result.ok) {
        setFile(null);
        setPreview(null);
        if (input.current) input.current.value = "";
        setUrl(remove ? null : await readPaymentQr(propertyId));
      }
    } catch {
      setMessage("ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="qr-settings stack" aria-label="รูป QR รับชำระเงิน">
      <h3>รูป QR รับชำระเงิน</h3>
      <p className="hint">
        รูปนี้แสดงบนลิงก์บิลทุกใบของหอนี้ รวมถึงบิลเดิม
        บันทึกรูปแยกจากข้อมูลหอพัก
      </p>
      {(preview || url) && (
        <Image
          className="qr-preview"
          src={preview || url!}
          alt={
            preview
              ? "ตัวอย่าง QR ที่เลือก ยังไม่บันทึก"
              : "QR รับชำระเงินที่บันทึกไว้"
          }
          width={240}
          height={240}
          unoptimized
        />
      )}
      <label>
        เลือกรูป QR (JPG, PNG หรือ WebP ไม่เกิน 2 MB)
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          onChange={(event) => {
            const selected = event.target.files?.[0] || null;
            setMessage("");
            setPreview(null);
            if (
              selected &&
              (selected.size > QR_MAX_BYTES ||
                !selected.size ||
                !["image/jpeg", "image/png", "image/webp"].includes(
                  selected.type,
                ))
            ) {
              setMessage("เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB");
              event.target.value = "";
              setFile(null);
            } else {
              setFile(selected);
              if (selected) setPreview(URL.createObjectURL(selected));
            }
          }}
        />
      </label>
      <div className="actions wrap">
        <button
          type="button"
          className="primary"
          disabled={pending || !file}
          onClick={() => save()}
        >
          {pending ? "กำลังดำเนินการ…" : "บันทึกรูป QR"}
        </button>
        {url && (
          <button
            type="button"
            className="secondary"
            disabled={pending}
            onClick={() => save(true)}
          >
            ลบรูป QR
          </button>
        )}
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
