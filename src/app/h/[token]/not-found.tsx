import Link from "next/link";
export default function NotFound() {
  return (
    <main className="tenant-page">
      <section className="panel tenant-bill">
        <h1>ไม่พบลิงก์หรือบิลนี้</h1>
        <p>
          ลิงก์อาจถูกเปลี่ยน บิลถูกยกเลิก หรือหมดอายุ
          กรุณาขอลิงก์ล่าสุดจากเจ้าของหอพัก
        </p>
        <Link href="/login">เข้าสู่ระบบเจ้าของหอ</Link>
      </section>
    </main>
  );
}
