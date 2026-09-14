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

type Tab = "overview" | "billing" | "rooms" | "settings";
export function WorkspaceApp({
  data,
  initial,
}: {
  data: Workspace;
  initial: { property?: string; tab?: string; month?: string };
}) {
  const router = useRouter();
  const notify = useToast();
  const [tab, setTab] = useState<Tab>(
      ["overview", "billing", "rooms", "settings"].includes(initial.tab || "")
        ? (initial.tab as Tab)
        : "overview",
    ),
    [propertyId, setProperty] = useState(initial.property || ""),
    [month, setMonth] = useState(
      /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(initial.month || "")
        ? initial.month!
        : today().slice(0, 7),
    );
  const [modal, setModal] = useState<string | null>(null),
    [selectedRoom, setRoom] = useState<Tables<"rooms"> | null>(null);
  const [status, setStatus] = useState("all"),
    [query, setQuery] = useState(""),
    [step, setStep] = useState("meters"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [meterDirty, setMeterDirty] = useState(false),
    [meterEpoch, setMeterEpoch] = useState(0);
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
  const property = data.properties.find((p) => p.id === propertyId);
  const roomList = data.rooms
    .filter((r) => !propertyId || r.property_id === propertyId)
    .sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));
  const invoices = data.invoices.filter(
    (i) =>
      (!propertyId || i.property_id === propertyId) &&
      i.month === month + "-01",
  );
  const outstanding = data.invoices.filter(
    (i) =>
      (!propertyId || i.property_id === propertyId) &&
      !["draft", "void", "paid"].includes(i.status),
  );
  const occupied = new Set(
    data.tenancies.filter((t) => !t.moved_out).map((t) => t.room_id),
  );
  const paid = data.invoices.filter(
    (i) =>
      (!propertyId || i.property_id === propertyId) &&
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
  const visible = invoices
    .filter(
      (i) =>
        (status === "all" || billStatus(i) === status) &&
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
    if (next !== "overview" && !propertyId && data.properties[0])
      setProperty(data.properties[0].id);
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
        if (op === "issue_all") setModal(null);
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
          <span className="brand-icon">R</span>
          <span>
            RoomReady
          </span>
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
        <div className="side-bottom">
          <div className="owner-avatar">จ</div>
          <div>
            เจ้าของหอพัก<small>{data.properties.length} หอพักในบัญชี</small>
          </div>
            <button type="button" title="ออกจากระบบ" aria-label="ออกจากระบบ" onClick={() => setModal("logout")}>
              ↪
            </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <span className="breadcrumb">
            พื้นที่ทำงาน <span>/</span> {titles[tab]}
          </span>
          <div className="topbar-right">
            <span className="date-today">{dateLabel(today())}</span>
            <label className="sr-only" htmlFor="property">
              เลือกหอพัก
            </label>
            <select
              id="property"
              value={propertyId}
              onChange={(e) => {
                if (canLeave()) setProperty(e.target.value);
              }}
            >
              <option value="">ทุกหอพัก</option>
              {data.properties.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              className="small secondary"
              onClick={() => setModal("new-property")}
            >
              + เพิ่มหอพัก
            </button>
            <div className="mobile-logout">
              <button type="button" className="small secondary" aria-label="ออกจากระบบ" onClick={() => setModal("logout")}>
                ↪
              </button>
            </div>
          </div>
        </header>
        <main className="workspace">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {property?.name || "ทุกหอพักของคุณ"}
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
                            setStep("bills");
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
                              href={"/invoices/" + i.id}
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
                        <button
                          className="text-button"
                          onClick={() => setModal("new-property")}
                        >
                          + เพิ่ม
                        </button>
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
                            onClick={() => {
                              setProperty(p.id);
                              setTab("rooms");
                            }}
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
              {tab !== "overview" && !property ? (
                <Empty title="เลือกหอพักที่จะจัดการ">
                  เลือกหอพักจากเมนูด้านบน เพื่อเริ่มทำงาน
                </Empty>
              ) : null}
              {tab === "billing" && property && (
                <>
                  <div className="workflow-tabs">
                    <button
                      className={step === "meters" ? "active" : ""}
                      onClick={() => {
                        if (canLeave()) setStep("meters");
                      }}
                    >
                      <span>01</span> กรอกมิเตอร์
                    </button>
                    <button
                      className={step === "bills" ? "active" : ""}
                      onClick={() => {
                        if (canLeave()) setStep("bills");
                      }}
                    >
                      <span>02</span> ตรวจและออกบิล{" "}
                      <b>
                        {invoices.filter((i) => i.status === "draft").length}
                      </b>
                    </button>
                    <button
                      className={step === "share" ? "active" : ""}
                      onClick={() => {
                        if (canLeave()) setStep("share");
                      }}
                    >
                      <span>03</span> แชร์และรับชำระ
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
                            {step === "bills" ? "บิลเดือนนี้" : "ติดตามการชำระ"}{" "}
                            <span className="count">{invoices.length}</span>
                          </h2>
                          <small className="muted">
                            ครบกำหนดวันที่ {property.due_day} ของเดือนถัดไป
                          </small>
                        </div>
                        <div className="actions">
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => batch("drafts_create")}
                          >
                            สร้างบิลร่างเพิ่ม
                          </button>
                          <button
                            className="primary"
                            disabled={
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
                      </div>
                      <div className="table-tools">
                        <input
                          aria-label="ค้นหาห้องหรือผู้เช่า"
                          placeholder="ค้นหาห้อง / ชื่อผู้เช่า"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        <select
                          aria-label="สถานะบิล"
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                        >
                          <option value="all">ทุกสถานะ</option>
                          {Object.entries({
                            draft: "ร่าง",
                            issued: "รอชำระ",
                            slip_submitted: "รอตรวจสลิป",
                            paid: "จ่ายแล้ว",
                            overdue: "เกินกำหนด",
                            void: "ยกเลิก",
                          }).map(([s, t]) => (
                            <option key={s} value={s}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <span className="muted">
                          {visible.length} บิล · ฿
                          {money(visible.reduce((s, i) => s + i.total, 0))}
                        </span>
                      </div>
                      {visible.length === 0 ? (
                        <Empty title="ยังไม่มีบิลในรายการนี้">
                          กรอกและบันทึกมิเตอร์ แล้วสร้างบิลร่าง
                          หรือลองเปลี่ยนตัวกรอง
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
                                      href={"/invoices/" + i.id}
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
                                        href={"/invoices/" + i.id}
                                      >
                                        {i.status === "draft"
                                          ? "ตรวจ / แก้บิล"
                                          : i.status === "slip_submitted"
                                            ? "ตรวจสลิป"
                                            : "ดูบิล"}{" "}
                                        →
                                      </Link>
                                      {!["draft", "void"].includes(
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
                    <div className="room-grid">
                      {roomList.map((r) => {
                        const tenancy = data.tenancies.find(
                            (t) => t.room_id === r.id && !t.moved_out,
                          ),
                          tenant = data.tenants.find(
                            (t) => t.id === tenancy?.tenant_id,
                          );
                        if (
                          !(r.name + " " + (tenant?.name || "")).includes(query)
                        )
                          return null;
                        return (
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
                        );
                      })}
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
      {modal === "logout" && <LogoutDialog onClose={() => setModal(null)} unsaved={meterDirty} />}
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
                เพิ่มได้ครั้งละ 200 ห้อง ใช้อัตราเริ่มต้นของหอพัก
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
            disabled={busy}
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
          <select name="water_method" defaultValue={p?.water_method || "meter"}>
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
