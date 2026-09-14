"use client";

import { useFormStatus } from "react-dom";
import { logout } from "@/app/actions";
import { Modal } from "./ui";

function LogoutButtons({ onClose }: { onClose: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="actions" style={{ justifyContent: "flex-end" }}>
      <button type="button" className="secondary" onClick={onClose} disabled={pending}>
        ยกเลิก
      </button>
      <button type="submit" className="primary" disabled={pending}>
        {pending ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
      </button>
    </div>
  );
}

export function LogoutDialog({ onClose, unsaved }: { onClose: () => void; unsaved: boolean }) {
  return (
    <Modal title="ยืนยันออกจากระบบ" onClose={onClose}>
      <p>คุณต้องการออกจากระบบ RoomReady หรือไม่?</p>
      {unsaved && <p className="error">มีเลขมิเตอร์ที่ยังไม่บันทึก หากออกจากระบบ การแก้ไขนี้จะหายไป</p>}
      <form action={logout}>
        <LogoutButtons onClose={onClose} />
      </form>
    </Modal>
  );
}
