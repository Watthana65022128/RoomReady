"use client";
import Image from "next/image";
import { useState } from "react";
export function PaymentQr({ url }: { url: string | null | undefined }) {
  const [failed, setFailed] = useState(false);
  if (!url) return null;
  return (
    <div className="payment-qr">
      <strong>สแกน QR เพื่อชำระเงิน</strong>
      {failed ? (
        <p role="status">โหลดรูป QR ไม่สำเร็จ กรุณาโหลดหน้าใหม่</p>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label="เปิดรูป QR รับชำระเงินขนาดเต็ม"
        >
          <Image
            src={url}
            alt="QR รับชำระเงินของเจ้าของหอ"
            width={280}
            height={280}
            unoptimized
            onError={() => setFailed(true)}
          />
        </a>
      )}
      <p className="hint">
        แตะรูปเพื่อเปิดหรือบันทึก แล้วเลือกรูปในแอปธนาคาร
        <br />
        ตรวจชื่อผู้รับและกรอกยอดตามบิลก่อนยืนยันชำระเงิน
      </p>
    </div>
  );
}
