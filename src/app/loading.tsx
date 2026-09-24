import { BrandLogo } from "@/components/brand-logo";

export default function Loading() {
  return (
    <main className="loading" role="status">
      <BrandLogo />
      <h2>กำลังเปิด RoomReady…</h2>
      <p>กำลังโหลดข้อมูลล่าสุด</p>
    </main>
  );
}
