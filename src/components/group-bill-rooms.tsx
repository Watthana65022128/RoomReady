"use client";
import { useState } from "react";
import Link from "next/link";
import { monthLabel } from "@/lib/domain";
import type { GroupBillListing } from "@/lib/domain";
import { RoomPaymentNotice } from "./room-payment-notice";
import { BrandLogo } from "./brand-logo";

export function GroupBillRooms({
  token,
  listing,
  initialMonth,
}: {
  token: string;
  listing: GroupBillListing;
  initialMonth?: string;
}) {
  const months = [...new Set(listing.bills.map((bill) => bill.month))]
    .sort()
    .reverse();
  const [month, setMonth] = useState(
    months.includes(initialMonth || "") ? initialMonth! : months[0] || "",
  );
  const [search, setSearch] = useState("");
  const rooms = listing.bills
    .filter(
      (bill) =>
        bill.month === month &&
        bill.room_name
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
    )
    .sort((a, b) =>
      a.room_name.localeCompare(b.room_name, "th", { numeric: true }),
    );
  return (
    <main className="tenant-page group-bills-page">
      <div className="tenant-brand">
        <BrandLogo />
      </div>
      <section className="panel group-bills-panel">
        <header>
          <span className="eyebrow">{listing.property_name}</span>
          <h1>เลือกห้องของคุณ</h1>
          <p className="muted">ดูบิล ชำระเงิน และส่งสลิปได้ในหน้าเดียว</p>
        </header>
        <RoomPaymentNotice />
        {months.length > 0 ? (
          <>
            <div className="group-bill-filters">
              <label>
                รอบบิล
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  {months.map((value) => (
                    <option key={value} value={value}>
                      {monthLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ค้นหาเลขห้อง
                <input
                  type="search"
                  placeholder="เช่น 201"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            <div className="group-rooms-heading">
              <strong>{monthLabel(month)}</strong>
              <span>{rooms.length} ห้อง</span>
            </div>
            <div className="group-rooms-grid">
              {rooms.map((bill) => (
                <Link
                  prefetch={false}
                  className="group-room-link"
                  key={bill.id}
                  href={`/h/${token}/${bill.id}`}
                >
                  <span>ห้อง</span>
                  <strong>{bill.room_name}</strong>
                  <small>ดูบิลของห้องนี้ →</small>
                </Link>
              ))}
            </div>
            {rooms.length === 0 && (
              <p role="status" className="empty">
                ไม่พบห้องที่ค้นหา กรุณาตรวจเลขห้องอีกครั้ง
              </p>
            )}
          </>
        ) : (
          <div className="empty">
            <h2>ยังไม่มีบิลพร้อมชำระ</h2>
            <p>กรุณารอเจ้าของหอออกบิล แล้วเปิดลิงก์นี้อีกครั้ง</p>
          </div>
        )}
      </section>
      <p className="tenant-footer">
        ไม่พบห้องของคุณหรือยอดไม่ถูกต้อง โปรดติดต่อเจ้าของหอพัก
      </p>
    </main>
  );
}
