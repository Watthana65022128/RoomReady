"use client";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="loading">
      <h2>โหลดข้อมูลไม่สำเร็จ</h2>
      <p>ตรวจการเชื่อมต่อแล้วลองอีกครั้ง ข้อมูลที่บันทึกแล้วยังอยู่ครบ</p>
      <button className="primary" onClick={retry}>
        ลองอีกครั้ง
      </button>
    </main>
  );
}
