"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Tables } from "@/types/database";
import {
  type Workspace,
  money,
  today,
  monthLabel,
  billStatus,
  dateLabel,
} from "@/lib/domain";
import { command } from "@/app/actions";
import { LogoutDialog } from "./logout-dialog";
import { PaymentQrSettings } from "./payment-qr-settings";
import { SharePropertyBills } from "./share-property-bills";
import {
  Badge,
  Modal,
  Field,
  CommandForm,
  fields,
  Empty,
  ShareBill,
} from "./ui";
import { MeterGrid } from "./meters";
import { useToast } from "./toast";
import { useOwnerAccess } from "./owner-access";
import { PLANS, subscriptionAccess, type Subscription } from "@/lib/plans";
import { BrandLogo } from "./brand-logo";
import { dashboardHref, withReturnTo, type DashboardLocation } from "@/lib/navigation";
import { groupRoomsByFloor } from "@/lib/room-floors";

type Tab = DashboardLocation["tab"];
function LogoutButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="logout-button" onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 5H5v14h4M12 12h9m-4-4 4 4-4 4" />
      </svg>
      ออกจากระบบ
    </button>
  );
}
export function WorkspaceApp({
  data,
  initial,
  subscription,
  ownerEmail,
}: {
  data: Workspace;
  subscription: Subscription;
  ownerEmail: string;
  initial: { tab?: string; month?: string; step?: string; status?: string; q?: string };
}) {
  const router = useRouter();
  const notify = useToast();
  const canWrite = useOwnerAccess();
  const ownerLabel = ownerEmail || "บัญชีผู้ใช้";
  const ownerInitial = Array.from(ownerLabel)[0].toUpperCase();
  const access = { ...subscriptionAccess(subscription), active: canWrite };
  const roomSlots = Math.max(0, access.limit - data.rooms.length);
  const [tab, setTab] = useState<Tab>(
      ["overview", "billing", "rooms", "settings"].includes(initial.tab || "")
        ? (initial.tab as Tab)
        : "overview",
    ),
    [month, setMonth] = useState(
      /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(initial.month || "")
        ? initial.month!
        : today().slice(0, 7),
    );
  const [modal, setModal] = useState<string | null>(null),
    [selectedRoom, setRoom] = useState<Tables<"rooms"> | null>(null);
  const [status, setStatus] = useState(
      ["all", "issued", "slip_submitted", "paid", "overdue", "void"].includes(initial.status || "")
        ? initial.status!
        : "all",
    ),
    [query, setQuery] = useState(initial.q || ""),
    [step, setStep] = useState<DashboardLocation["step"]>(
      ["meters", "bills", "share"].includes(initial.step || "")
        ? (initial.step as DashboardLocation["step"])
        : "meters",
    ),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [meterDirty, setMeterDirty] = useState(false),
    [meterEpoch, setMeterEpoch] = useState(0);
  const dashboardUrl = dashboardHref({ tab, month, step, status, query });
  useEffect(() => {
    if (window.location.pathname !== "/dashboard") return;
    if (window.location.pathname + window.location.search !== dashboardUrl) {
      window.history.replaceState(window.history.state, "", dashboardUrl);
    }
  }, [dashboardUrl]);
  useEffect(() => {
    if (!meterDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [meterDirty]);
  function canLeave() {
    if (
      meterDirty &&
      !window.confirm(
        "มีเลขมิเตอร์ที่ยังไม่บันทึก ต้องการออกจากหน้านี้และทิ้งการแก้ไขหรือไม่?",
      )
    )
      return false;
    if (meterDirty) setMeterEpoch((n) => n + 1);
    setMeterDirty(false);
    return true;
  }
  const property = data.properties[0];
  const roomList = data.rooms
    .filter((r) => r.property_id === property?.id)
    .sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));
  const invoices = data.invoices.filter(
    (i) =>
      i.property_id === property?.id &&
      i.month === month + "-01",
  );
  const outstanding = data.invoices.filter(
    (i) =>
      i.property_id === property?.id &&
      !["draft", "void", "paid"].includes(i.status),
  );
  const occupied = new Set(
    data.tenancies.filter((t) => !t.moved_out).map((t) => t.room_id),
  );
  const paid = data.invoices.filter(
    (i) =>
      i.property_id === property?.id &&
      i.status === "paid" &&
      i.paid_at &&
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
      })
        .format(new Date(i.paid_at))
        .startsWith(month),
  );
  const overdue = outstanding.filter((i) => i.due_date < today());
  const stepInvoices = invoices.filter((i) =>
    step === "bills" ? i.status === "draft" : i.status !== "draft",
  );
  const visible = stepInvoices
    .filter(
      (i) =>
        (step === "bills" ||
          (status === "all"
            ? i.status !== "void"
            : billStatus(i) === status)) &&
        (i.room_name + " " + i.tenant_name)
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      a.room_name.localeCompare(b.room_name, "th", { numeric: true }),
    );
  const close = () => {
    setModal(null);
    setRoom(null);
    router.refresh();
  };
  function navigate(next: Tab) {
    if (!canLeave()) return;
    setTab(next);
    setQuery("");
  }
  async function batch(op: string) {
    if (!property) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await command(op, {
        property_id: property.id,
        month: month + "-01",
      });
      setMessage(r.message);
      notify(r.message, r.ok ? "success" : "error");
      if (r.ok) {
        if (op === "drafts_create") setStep("bills");
        if (op === "issue_all") {
          setModal(null);
          setStep("share");
          setStatus("all");
          setQuery("");
        }
        router.refresh();
      }
    } catch {
      setMessage("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง");
      notify("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง", "error");
    } finally {
      setBusy(false);
    }
  }
  const occupiedCount = roomList.filter((r) => occupied.has(r.id)).length;
  const visibleRooms = roomList
    .map((room) => {
      const tenancy = data.tenancies.find(
        (item) => item.room_id === room.id && !item.moved_out,
      );
      const tenant = data.tenants.find((item) => item.id === tenancy?.tenant_id);
      return { ...room, room, tenancy, tenant };
    })
    .filter(({ room, tenant }) =>
      (room.name + " " + (tenant?.name || "")).includes(query),
    );
  const roomFloors = groupRoomsByFloor(visibleRooms);
  const titles = {
    overview: "ภาพรวม",
    billing: "รอบบิลประจำเดือน",
    rooms: "ห้องและผู้เช่า",
    settings: "ตั้งค่าหอพัก",
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <BrandLogo />
        </Link>
        <div className="side-caption">พื้นที่ทำงาน</div>
        <nav>
          {(
            [
              ["overview", "◫", "ภาพรวม"],
              ["billing", "▤", "รอบบิล"],
              ["rooms", "▦", "ห้องและผู้เช่า"],
              ["settings", "⚙", "ตั้งค่าหอพัก"],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={tab === id ? "nav-active" : ""}
            >
              <span>{icon}</span>
              {label}
              {id === "billing" &&
                outstanding.filter((i) => i.status === "slip_submitted")
                  .length > 0 && (
                  <b>
                    {
                      outstanding.filter((i) => i.status === "slip_submitted")
                        .length
                    }
                  </b>
                )}
            </button>
          ))}
        </nav>
        <Link href={withReturnTo("/subscription", dashboardUrl)} className="subscription-side-link">
          แพ็กเกจและสิทธิ์ใช้งาน ↗
        </Link>
        <div className="side-bottom">
          <div className="owner-profile">
            <div className="owner-avatar" aria-hidden="true">{ownerInitial}</div>
            <div className="owner-identity">
              <span className="owner-email" title={ownerLabel}>{ownerLabel}</span>
              <small>{data.properties.length} หอพักในบัญชี</small>
            </div>
          </div>
          <LogoutButton onClick={() => setModal("logout")} />
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <span className="breadcrumb">
            พื้นที่ทำงาน <span>/</span> {titles[tab]}
          </span>
          <div className="topbar-right">
            <span className="date-today">{dateLabel(today())}</span>
            <div className="mobile-account">
              <div className="owner-profile">
                <div className="owner-avatar" aria-hidden="true">{ownerInitial}</div>
                <div className="owner-identity">
                  <span className="owner-email" title={ownerLabel}>{ownerLabel}</span>
                </div>
              </div>
              <LogoutButton onClick={() => setModal("logout")} />
            </div>
          </div>
        </header>
        <main className="workspace">
          <div
            className={`subscription-banner ${access.active ? "" : "expired"}`}
          >
            <div>
              <strong>
                {access.trial
                  ? `ทดลองฟรี · เหลือ ${access.daysLeft} วัน`
                  : PLANS[subscription.plan as keyof typeof PLANS].name}
              </strong>
              <span>
                {" "}
                ใช้แล้ว {data.rooms.length} / {access.limit} ห้อง · 1
                หอพักต่อบัญชี
              </span>
              {!access.active && (
                <p>
                  สิทธิ์หมดอายุแล้ว ดูข้อมูลเดิมได้
                  แต่ยังบันทึกการเปลี่ยนแปลงไม่ได้
                </p>
              )}
              {data.rooms.length > access.limit && (
                <p>
                  เก็บข้อมูลเดิมครบแล้ว เพิ่มห้องได้เมื่อจำนวนห้องต่ำกว่าโควตา
                </p>
              )}
            </div>
            <Link href={withReturnTo("/subscription", dashboardUrl)}>
              {access.active ? "จัดการแพ็กเกจ →" : "ขอเปิดใช้แพ็กเกจ →"}
            </Link>
          </div>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {property?.name || "หอพักของคุณ"}
              </span>
              <h1>{titles[tab]}</h1>
              <p className="muted">
                {tab === "overview"
                  ? "เงินเข้า ห้องว่าง และงานที่รอคุณจัดการ"
                  : tab === "billing"
                    ? "กรอกครั้งเดียว ตรวจทั้งหอ แล้วส่งบิลได้ทันที"
                    : tab === "rooms"
                      ? "ข้อมูลห้อง อัตราค่าเช่า และประวัติการเข้าพัก"
                      : "กำหนดค่าเริ่มต้น ใช้ต่อเนื่องได้ทุกรอบบิล"}
              </p>
            </div>
            {["overview", "billing"].includes(tab) && (
              <label className="month-picker">
                รอบเดือน
                <input
                  type="month"
                  value={month}
                  min="2020-01"
                  max="2100-12"
                  onChange={(e) => {
                    if (e.target.value && canLeave()) setMonth(e.target.value);
                  }}
                />
              </label>
            )}
          </div>
          {data.properties.length === 0 ? (
            <section className="onboarding">
              <span className="eyebrow">เริ่มต้นเพียง 3 ขั้นตอน</span>
              <h2>
                หอพักแรกของคุณ
                <br />
                พร้อมเริ่มต้นที่นี่
              </h2>
              <p>เพิ่มหอพัก → เพิ่มห้องและผู้เช่า → เริ่มรอบบิล</p>
              <button
                className="primary"
                disabled={!access.active}
                onClick={() => setModal("new-property")}
              >
                + เพิ่มหอพักแรก
              </button>
            </section>
          ) : (
            <>
              {tab === "overview" && (
                <>
                  <section className="stats">
                    <article className="stat accent">
                      <span>รับชำระแล้ว · {monthLabel(month + "-01")}</span>
                      <strong>
                        <small>฿</small>
                        {money(paid.reduce((s, i) => s + i.total, 0))}
                      </strong>
                      <footer>{paid.length} บิลที่ยืนยันรับเงิน</footer>
                    </article>
                    <article className="stat">
                      <span>ยอดค้างชำระ · ทุกรอบ</span>
                      <strong>
                        <small>฿</small>
                        {money(outstanding.reduce((s, i) => s + i.total, 0))}
                      </strong>
                      <footer className={overdue.length ? "text-danger" : ""}>
                        {overdue.length} บิลเกินกำหนด ·{" "}
                        {new Set(outstanding.map((i) => i.room_id)).size}{" "}
                        ห้องค้างจ่าย
                      </footer>
                    </article>
                    <article className="stat">
                      <span>ห้องว่าง</span>
                      <strong>
                        {roomList.length - occupiedCount}
                        <small> / {roomList.length} ห้อง</small>
                      </strong>
                      <footer>มีผู้เช่า {occupiedCount} ห้อง</footer>
                    </article>
                    <article className="stat">
                      <span>อัตราเข้าพัก</span>
                      <strong>
                        {roomList.length
                          ? Math.round((occupiedCount / roomList.length) * 100)
                          : 0}
                        <small>%</small>
                      </strong>
                      <div className="occupancy-track">
                        <i
                          style={{
                            width:
                              (roomList.length
                                ? (occupiedCount / roomList.length) * 100
                                : 0) + "%",
                          }}
                        />
                      </div>
                      <footer>จากทุกห้องในหอที่เลือก</footer>
                    </article>
                  </section>
                  <section className="cycle-banner">
                    <div>
                      <span className="eyebrow">
                        รอบบิล {monthLabel(month + "-01")}
                      </span>
                      <h2>งานเดือนนี้ ไปถึงไหนแล้ว?</h2>
                      <div className="progress-steps">
                        <span>{invoices.length} บิลทั้งหมด</span>
                        <span>
                          {invoices.filter((i) => i.status === "draft").length}{" "}
                          รอออกบิล
                        </span>
                        <span>
                          {invoices.filter((i) => i.status === "paid").length}{" "}
                          จ่ายแล้ว
                        </span>
                      </div>
                    </div>
                    <button
                      className="primary"
                      onClick={() => navigate("billing")}
                    >
                      จัดการรอบบิล <span>→</span>
                    </button>
                  </section>
                  <div className="overview-columns">
                    <section className="panel">
                      <div className="panel-head">
                        <h2>
                          รอตรวจสลิป{" "}
                          <span className="count">
                            {
                              outstanding.filter(
                                (i) => i.status === "slip_submitted",
                              ).length
                            }
                          </span>
                        </h2>
                        <button
                          className="text-button"
                          onClick={() => {
                            navigate("billing");
                            setStep("share");
                            setStatus("slip_submitted");
                          }}
                        >
                          ดูรอบที่เลือก →
                        </button>
                      </div>
                      {outstanding.filter((i) => i.status === "slip_submitted")
                        .length === 0 ? (
                        <Empty title="ไม่มีสลิปรอตรวจ">
                          เมื่อผู้เช่าส่งสลิป จะแสดงที่นี่ให้คุณตรวจและยืนยัน
                        </Empty>
                      ) : (
                        outstanding
                          .filter((i) => i.status === "slip_submitted")
                          .slice(0, 8)
                          .map((i) => (
                            <Link
                              className="review-row"
                              href={withReturnTo("/invoices/" + i.id, dashboardUrl)}
                              key={i.id}
                            >
                              <span className="room-tile">{i.room_name}</span>
                              <span>
                                <b>{i.tenant_name}</b>
                                <small>
                                  {i.property_name} · {monthLabel(i.month)}
                                </small>
                              </span>
                              <strong>฿{money(i.total)}</strong>
                              <span>→</span>
                            </Link>
                          ))
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-head">
                        <h2>หอพักของคุณ</h2>
                      </div>
                      {data.properties.map((p) => {
                        const rs = data.rooms.filter(
                            (r) => r.property_id === p.id,
                          ),
                          oc = rs.filter((r) => occupied.has(r.id)).length;
                        return (
                          <button
                            className="property-row"
                            key={p.id}
                            onClick={() => navigate("rooms")}
                          >
                            <span className="property-symbol">▦</span>
                            <span>
                              <b>{p.name}</b>
                              <small>
                                {rs.length} ห้อง · มีผู้เช่า {oc} ห้อง
                              </small>
                            </span>
                            <span className="badge vacant">
                              ว่าง {rs.length - oc}
                            </span>
                          </button>
                        );
                      })}
                    </section>
                  </div>
                </>
              )}
              {tab === "billing" && property && (
                <>
                  <div className="workflow-tabs">
                    <button
                      className={step === "meters" ? "active" : ""}
                      onClick={() => {
                        if (canLeave()) setStep("meters");
                      }}
                    >
                      <span>1</span> กรอกมิเตอร์
                    </button>
                    <button
                      className={step === "bills" ? "active" : ""}
                      onClick={() => {
                        if (canLeave()) setStep("bills");
                      }}
                    >
                      <span>2</span> ตรวจและออกบิล{" "}
                      <b>
                        {invoices.filter((i) => i.status === "draft").length}
                      </b>
                    </button>
                    <button
                      className={step === "share" ? "active" : ""}
                      onClick={() => {
                        if (canLeave()) {
                          setStep("share");
                          setStatus("all");
                        }
                      }}
                    >
                      <span>3</span> แชร์และรับชำระ
                    </button>
                  </div>
                  {message && (
                    <p className="notice" role="status">
                      {message}
                    </p>
                  )}
                  {step === "meters" ? (
                    <MeterGrid
                      onDirty={setMeterDirty}
                      key={property.id + month + meterEpoch}
                      data={data}
                      property={property}
                      month={month}
                      onDraft={() => batch("drafts_create")}
                      busy={busy}
                    />
                  ) : (
                    <section className="panel">
                      <div className="panel-head wrap">
                        <div>
                          <h2>
                            {step === "bills"
                              ? "บิลร่างรอตรวจและออกบิล"
                              : "ติดตามการชำระ"}{" "}
                            <span className="count">{visible.length}</span>
                          </h2>
                          <small className="muted">
                            ครบกำหนดวันที่ {property.due_day} ของเดือนถัดไป
                          </small>
                        </div>
                        {step === "share" && (
                          <SharePropertyBills
                            key={property.id}
                            propertyId={property.id}
                            name={property.name}
                          />
                        )}
                        {step === "bills" && (
                          <div className="actions">
                            <button
                              className="secondary"
                              disabled={busy || !canWrite}
                              onClick={() => batch("drafts_create")}
                            >
                              สร้างบิลร่างเพิ่ม
                            </button>
                            <button
                              className="primary"
                              disabled={
                                !canWrite ||
                                busy ||
                                !invoices.some((i) => i.status === "draft")
                              }
                              onClick={() => setModal("issue")}
                            >
                              ออกบิลร่างทั้งหมด (
                              {
                                invoices.filter((i) => i.status === "draft")
                                  .length
                              }
                              )
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="table-tools">
                        <input
                          aria-label="ค้นหาห้องหรือผู้เช่า"
                          placeholder="ค้นหาห้อง / ชื่อผู้เช่า"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        {step === "share" && (
                          <select
                            aria-label="สถานะบิล"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                          >
                            <option value="all">บิลที่ออกแล้วทั้งหมด</option>
                            {Object.entries({
                              issued: "รอชำระ",
                              slip_submitted: "รอตรวจสลิป",
                              paid: "จ่ายแล้ว",
                              overdue: "เกินกำหนด",
                              void: "ประวัติบิลยกเลิก",
                            }).map(([s, t]) => (
                              <option key={s} value={s}>
                                {t}
                              </option>
                            ))}
                          </select>
                        )}
                        <span className="muted">
                          {visible.length} บิล · ฿
                          {money(visible.reduce((s, i) => s + i.total, 0))}
                        </span>
                      </div>
                      {visible.length === 0 ? (
                        <Empty
                          title={
                            step === "bills"
                              ? "ไม่มีบิลร่างรอตรวจ"
                              : "ไม่มีบิลในรายการนี้"
                          }
                        >
                          {step === "bills"
                            ? "กรอกและบันทึกมิเตอร์เพื่อสร้างบิลร่าง หรือไปขั้นแชร์และรับชำระเพื่อดูบิลที่ออกแล้ว"
                            : "ออกบิลจากขั้นตรวจและออกบิลก่อนแชร์และรับชำระ หรือลองเปลี่ยนตัวกรอง"}
                        </Empty>
                      ) : (
                        <div className="table-scroll">
                          <table className="bill-table">
                            <thead>
                              <tr>
                                <th>ห้อง / ผู้เช่า</th>
                                <th>ยอดรวม</th>
                                <th>ครบกำหนด</th>
                                <th>สถานะ</th>
                                <th>จัดการ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visible.map((i) => (
                                <tr key={i.id}>
                                  <td>
                                    <Link
                                      className="room-link"
                                      href={withReturnTo("/invoices/" + i.id, dashboardUrl)}
                                    >
                                      {i.room_name}
                                    </Link>
                                    <small>{i.tenant_name}</small>
                                  </td>
                                  <td className="number">฿{money(i.total)}</td>
                                  <td>{dateLabel(i.due_date)}</td>
                                  <td>
                                    <Badge invoice={i} />
                                  </td>
                                  <td>
                                    <div className="actions">
                                      <Link
                                        className="small text-button"
                                        href={withReturnTo("/invoices/" + i.id, dashboardUrl)}
                                      >
                                        {i.status === "draft"
                                          ? "ตรวจ / แก้บิล"
                                          : i.status === "slip_submitted"
                                            ? "ตรวจสลิป"
                                            : ["issued", "overdue"].includes(
                                                  i.status,
                                                )
                                              ? "รับชำระ / ดูบิล"
                                              : "ดูบิล"}{" "}
                                        →
                                      </Link>
                                      {step === "share" &&
                                        !["draft", "void"].includes(
                                          i.status,
                                        ) && (
                                          <ShareBill
                                            token={i.token}
                                            room={i.room_name}
                                            total={money(i.total)}
                                          />
                                        )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
              {tab === "rooms" && property && (
                <section className="panel">
                  <div className="panel-head">
                    <h2>
                      ห้องทั้งหมด{" "}
                      <span className="count">{roomList.length}</span>
                    </h2>
                    <button
                      className="primary"
                      disabled={!access.active || roomSlots === 0}
                      onClick={() => setModal("rooms-add")}
                    >
                      + เพิ่มหลายห้อง
                    </button>
                  </div>
                  <div className="table-tools">
                    <input
                      aria-label="ค้นหาห้อง"
                      placeholder="ค้นหาห้อง / ผู้เช่า"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <span className="muted">
                      ว่าง {roomList.length - occupiedCount} · มีผู้เช่า{" "}
                      {occupiedCount}
                    </span>
                  </div>
                  {roomList.length === 0 ? (
                    <Empty title="เพิ่มห้องครั้งเดียวได้ทั้งชั้น">
                      ใส่เลขห้องหลายรายการเพื่อเริ่มต้น
                      แล้วเพิ่มผู้เช่าแต่ละห้อง
                    </Empty>
                  ) : (
                    <div className="room-floors">
                      {roomFloors.map(({ floor, rooms }) => (
                        <section
                          className="room-floor"
                          key={floor}
                          aria-label={floor ? `ชั้น ${floor}` : "ไม่ระบุชั้น"}
                        >
                          <div className="room-floor-heading">
                            <h3>{floor ? `ชั้น ${floor}` : "ไม่ระบุชั้น"}</h3>
                            <span>{rooms.length} ห้อง</span>
                          </div>
                          <div className="room-grid">
                            {rooms.map(({ room: r, tenancy, tenant }) => (
                              <button
                                className={
                                  "room-card " + (tenancy ? "occupied" : "")
                                }
                                key={r.id}
                                onClick={() => {
                                  setRoom(r);
                                  setModal("room");
                                }}
                              >
                                <div>
                                  <strong>{r.name}</strong>
                                  <span
                                    className={
                                      "badge " + (tenancy ? "occupied" : "vacant")
                                    }
                                  >
                                    {tenancy ? "มีผู้เช่า" : "ห้องว่าง"}
                                  </span>
                                </div>
                                <p>{tenant?.name || "พร้อมรับผู้เช่า"}</p>
                                <footer>
                                  <span>ชั้น {r.floor || "—"}</span>
                                  <span>
                                    ฿{money(r.rent ?? property.rent)} / เดือน
                                  </span>
                                </footer>
                              </button>
                            ))}
                          </div>
                        </section>
                      ))}
                      {roomFloors.length === 0 && (
                        <p className="room-search-empty" role="status">
                          ไม่พบห้องที่ตรงกับคำค้นหา
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )}
              {tab === "settings" && property && (
                <section className="panel settings-panel">
                  <div className="panel-head">
                    <h2>ค่าเริ่มต้นของ {property.name}</h2>
                  </div>
                  <PropertyForm
                    key={property.id}
                    property={property}
                    data={data}
                    onDone={() => {
                      setMessage("บันทึกการตั้งค่าแล้ว");
                      router.refresh();
                    }}
                  />
                  {message && <p className="notice">{message}</p>}
                </section>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>RoomReady</span>
            <span>จัดการวันนี้ ให้เดือนหน้าเบาขึ้น</span>
          </footer>
        </main>
      </div>
      {modal === "logout" && (
        <LogoutDialog onClose={() => setModal(null)} unsaved={meterDirty} />
      )}
      {modal === "new-property" && (
        <Modal title="เพิ่มหอพัก" onClose={close}>
          <PropertyForm data={data} onDone={close} />
        </Modal>
      )}
      {modal === "rooms-add" && property && (
        <Modal title="เพิ่มห้องพัก" onClose={close}>
          <CommandForm
            op="rooms_add"
            build={(f) => ({
              property_id: property.id,
              floor: String(f.get("floor") || ""),
              names: String(f.get("names") || "")
                .split(/[\n,]+/)
                .map((s) => s.trim())
                .filter(Boolean),
            })}
            onDone={close}
          >
            <div className="stack">
              <Field label="ชั้น" name="floor" placeholder="เช่น 1" />
              <label>
                เลขห้อง (หนึ่งห้องต่อบรรทัด หรือคั่นด้วยจุลภาค)
                <textarea
                  name="names"
                  required
                  rows={6}
                  placeholder={"101, 102, 103, 104"}
                />
              </label>
              <p className="hint">
                เพิ่มได้อีก {roomSlots} ห้อง ใช้อัตราเริ่มต้นของหอพัก
              </p>
            </div>
          </CommandForm>
        </Modal>
      )}
      {modal === "room" && selectedRoom && property && (
        <RoomModal
          room={selectedRoom}
          property={property}
          data={data}
          onClose={close}
        />
      )}
      {modal === "issue" && (
        <Modal title="ยืนยันออกบิลทั้งรอบ" onClose={close}>
          <p>
            ออกบิลร่าง {invoices.filter((i) => i.status === "draft").length} ใบ
            รวม ฿
            {money(
              invoices
                .filter((i) => i.status === "draft")
                .reduce((s, i) => s + i.total, 0),
            )}{" "}
            หลังออกบิลจะไม่สามารถแก้ยอดได้
          </p>
          <p className="hint">ตรวจบัญชีรับเงินและยอดแต่ละห้องก่อนยืนยัน</p>
          <button
            className="primary"
            disabled={busy || !canWrite}
            onClick={() => batch("issue_all")}
          >
            {busy ? "กำลังออกบิล…" : "ยืนยันออกบิล"}
          </button>
          {message && <p role="status">{message}</p>}
        </Modal>
      )}
    </div>
  );
}

function PropertyForm({
  property: p,
  data,
  onDone,
}: {
  property?: Tables<"properties">;
  data: Workspace;
  onDone: () => void;
}) {
  return (
    <>
      <CommandForm
        op="property_save"
        onDone={onDone}
        build={(f) => ({
          ...fields(f),
          id: p?.id || "",
          charges: String(f.get("charges") || "")
            .split("\n")
            .filter((s) => s.trim())
            .map((s) => {
              const [label, amount] = s.split("|");
              return { label: label.trim(), amount: amount?.trim() || "0" };
            }),
        })}
      >
        <div className="form-grid">
          <Field name="name" label="ชื่อหอพัก" value={p?.name} required />
          <Field name="address" label="ที่อยู่" value={p?.address} />
          <Field
            name="rent"
            label="ค่าเช่าเริ่มต้น / เดือน (บาท)"
            type="number"
            value={p?.rent ?? 0}
            min="0"
            max="999999"
            step="0.01"
            required
          />
          <Field
            name="due_day"
            label="ครบกำหนดวันที่ (เดือนถัดไป)"
            type="number"
            value={p?.due_day ?? 5}
            min="1"
            max="28"
            required
          />
          <label>
            วิธีคิดค่าน้ำ
            <select
              name="water_method"
              defaultValue={p?.water_method || "meter"}
            >
              <option value="meter">ตามมิเตอร์ (บาท / หน่วย)</option>
              <option value="flat">เหมาจ่าย (บาท / เดือน)</option>
            </select>
          </label>
          <Field
            name="water_rate"
            label="อัตราค่าน้ำ"
            value={p?.water_rate ?? 0}
            type="number"
            min="0"
            max="999999"
            step="0.01"
            required
          />
          <Field
            name="electric_rate"
            label="ค่าไฟ (บาท / หน่วย)"
            value={p?.electric_rate ?? 0}
            type="number"
            min="0"
            max="999999"
            step="0.01"
            required
          />
          <label className="full">
            ข้อมูลรับเงินที่แสดงบนบิล
            <textarea
              name="payment_info"
              required
              maxLength={2000}
              defaultValue={p?.payment_info}
              placeholder="ธนาคาร / เลขบัญชี / ชื่อบัญชี"
            />
          </label>
          <label className="full">
            ค่าใช้จ่ายประจำ (ชื่อรายการ | จำนวนบาท)
            <textarea
              name="charges"
              rows={3}
              defaultValue={data.charges
                .filter((c) => c.property_id === p?.id)
                .map((c) => c.label + " | " + c.amount)
                .join("\n")}
              placeholder={"อินเทอร์เน็ต | 200\nที่จอดรถ | 300"}
            />
          </label>
        </div>
        <p className="hint">
          เปลี่ยนค่าเริ่มต้นมีผลกับบิลที่สร้างใหม่ บิลเดิมเก็บยอดเดิมไว้
        </p>
      </CommandForm>
      {p ? (
        <PaymentQrSettings key={p.id} propertyId={p.id} />
      ) : (
        <p className="hint">
          บันทึกหอพักก่อน แล้วเพิ่มรูป QR รับชำระเงินได้ในการตั้งค่าหอ
        </p>
      )}
    </>
  );
}
function RoomModal({
  room: r,
  property: p,
  data,
  onClose,
}: {
  room: Tables<"rooms">;
  property: Tables<"properties">;
  data: Workspace;
  onClose: () => void;
}) {
  const active = data.tenancies.find((t) => t.room_id === r.id && !t.moved_out),
    tenant = data.tenants.find((t) => t.id === active?.tenant_id);
  const [section, setSection] = useState("tenant");
  return (
    <Modal title={"ห้อง " + r.name} onClose={onClose}>
      <div className="segmented">
        <button
          className={section === "tenant" ? "active" : ""}
          onClick={() => setSection("tenant")}
        >
          ผู้เช่า
        </button>
        <button
          className={section === "rates" ? "active" : ""}
          onClick={() => setSection("rates")}
        >
          ข้อมูลห้อง / อัตรา
        </button>
        <button
          className={section === "history" ? "active" : ""}
          onClick={() => setSection("history")}
        >
          ประวัติ
        </button>
      </div>
      {section === "rates" ? (
        <CommandForm
          op="room_save"
          build={(f) => ({ ...fields(f), id: r.id, property_id: p.id })}
          onDone={onClose}
        >
          <div className="form-grid">
            <Field name="name" label="เลขห้อง" value={r.name} required />
            <Field name="floor" label="ชั้น" value={r.floor} />
            {(["rent", "water_rate", "electric_rate"] as const).map(
              (key, j) => (
                <Field
                  key={key}
                  name={key}
                  label={
                    ["ค่าเช่าเฉพาะห้อง", "ค่าน้ำเฉพาะห้อง", "ค่าไฟเฉพาะห้อง"][j]
                  }
                  value={r[key]}
                  type="number"
                  min="0"
                  max="999999"
                  step="0.01"
                  placeholder={"ค่าเริ่มต้น " + p[key]}
                />
              ),
            )}
          </div>
          <p className="hint">เว้นว่างเพื่อใช้อัตราเริ่มต้นของหอพัก</p>
        </CommandForm>
      ) : section === "history" ? (
        <div className="stack">
          {data.tenancies
            .filter((t) => t.room_id === r.id)
            .sort((a, b) => b.moved_in.localeCompare(a.moved_in))
            .map((t) => (
              <div className="history-row" key={t.id}>
                <b>{data.tenants.find((te) => te.id === t.tenant_id)?.name}</b>
                <small>
                  {dateLabel(t.moved_in)} —{" "}
                  {t.moved_out ? dateLabel(t.moved_out) : "ปัจจุบัน"}
                </small>
              </div>
            ))}
        </div>
      ) : active ? (
        <>
          <div className="tenant-summary">
            <span className="eyebrow">ผู้เช่าปัจจุบัน</span>
            <h3>{tenant?.name}</h3>
            <p>{tenant?.phone || "ไม่ระบุโทรศัพท์"}</p>
            <small>เข้าพัก {dateLabel(active.moved_in)}</small>
          </div>
          <CommandForm
            op="tenant_moveout"
            build={(f) => ({ ...fields(f), id: active.id, property_id: p.id })}
            onDone={onClose}
            label="ยืนยันย้ายออก"
          >
            <Field
              name="moved_out"
              label="วันย้ายออก"
              type="date"
              value={today()}
              min={active.moved_in}
              max={today()}
              required
            />
            <p className="hint">
              บิลและประวัติเดิมจะยังอยู่ ห้องจะเปลี่ยนเป็นห้องว่าง
            </p>
          </CommandForm>
        </>
      ) : (
        <CommandForm
          op="tenant_movein"
          build={(f) => ({ ...fields(f), room_id: r.id, property_id: p.id })}
          onDone={onClose}
          label="เพิ่มผู้เช่า"
        >
          <div className="stack">
            <Field name="name" label="ชื่อผู้เช่า" required />
            <Field name="phone" label="โทรศัพท์" type="tel" />
            <Field
              name="moved_in"
              label="วันย้ายเข้า"
              type="date"
              value={today()}
              max={today()}
              required
            />
          </div>
        </CommandForm>
      )}
    </Modal>
  );
}
