"use client";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="tenant-page">
      <section className="panel tenant-bill">
        <h1>โหลดบิลไม่สำเร็จ</h1>
        <p>กรุณาลองอีกครั้ง หรือติดต่อเจ้าของหอพัก</p>
        <button className="primary" onClick={retry}>
          ลองอีกครั้ง
        </button>
      </section>
    </main>
  );
}
