"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { command } from "@/app/actions";
import { type Workspace, money, usage, lineTotal } from "@/lib/domain";
import type { Tables } from "@/types/database";
import { Empty } from "./ui";
import { useToast } from "./toast";
type Reading = {
  room_id: string;
  water_previous: string;
  water_current: string;
  electric_previous: string;
  electric_current: string;
};
type Key = Exclude<keyof Reading, "room_id">;
export function MeterGrid({
  data,
  property: p,
  month,
  onDraft,
  busy,
  onDirty,
}: {
  data: Workspace;
  property: Tables<"properties">;
  month: string;
  onDraft: () => void;
  busy: boolean;
  onDirty: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const notify = useToast();
  const active = new Set(
    data.tenancies
      .filter((t) => !t.moved_out && t.moved_in < month + "-32")
      .map((t) => t.room_id),
  );
  const rooms = data.rooms
    .filter((r) => r.property_id === p.id && active.has(r.id))
    .sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));
  const cycle = data.cycles.find(
    (c) => c.property_id === p.id && c.month === month + "-01",
  );
  const priorCycles = data.cycles
    .filter((c) => c.property_id === p.id && c.month < month + "-01")
    .sort((a, b) => b.month.localeCompare(a.month));
  const previous = (id: string) => {
    for (const c of priorCycles) {
      const r = data.readings.find(
        (m) => m.cycle_id === c.id && m.room_id === id,
      );
      if (r) return r;
    }
  };
  const initial = () =>
    Object.fromEntries(
      rooms.map((r) => {
        const current = data.readings.find(
            (m) => m.cycle_id === cycle?.id && m.room_id === r.id,
          ),
          last = previous(r.id);
        return [
          r.id,
          {
            room_id: r.id,
            water_previous: String(
              current?.water_previous ?? last?.water_current ?? "",
            ),
            water_current: String(current?.water_current ?? ""),
            electric_previous: String(
              current?.electric_previous ?? last?.electric_current ?? "",
            ),
            electric_current: String(current?.electric_current ?? ""),
          },
        ];
      }),
    );
  const [rows, setRows] = useState<Record<string, Reading>>(initial),
    [dirty, setDirty] = useState<Set<string>>(new Set()),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const locked = (id: string) =>
    data.invoices.some(
      (i) =>
        i.cycle_id === cycle?.id && i.room_id === id && i.status !== "void",
    );
  const savedReady = rooms.filter((r) => {
    const m = data.readings.find(
      (m) => m.cycle_id === cycle?.id && m.room_id === r.id,
    );
    return (
      !locked(r.id) &&
      m &&
      usage(m.electric_previous, m.electric_current) !== null &&
      (p.water_method === "flat" ||
        usage(m.water_previous, m.water_current) !== null)
    );
  }).length;
  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const result = await command("meters_save", {
        property_id: p.id,
        month: month + "-01",
        rows: [...dirty].map((id) => rows[id]),
      });
      setMessage(result.message);
      notify(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        setDirty(new Set());
        onDirty(false);
        router.refresh();
      }
    } catch {
      setMessage("บันทึกไม่สำเร็จ ข้อมูลยังอยู่ในตาราง ลองอีกครั้ง");
      notify("บันทึกไม่สำเร็จ ข้อมูลยังอยู่ในตาราง ลองอีกครั้ง", "error");
    } finally {
      setSaving(false);
    }
  }
  const keys: Key[] =
    p.water_method === "meter"
      ? [
          "water_previous",
          "water_current",
          "electric_previous",
          "electric_current",
        ]
      : ["electric_previous", "electric_current"];
  return (
    <section className="panel">
      <div className="panel-head wrap">
        <div>
          <h2>
            จดมิเตอร์ <span className="count">{rooms.length} ห้อง</span>
          </h2>
          <p className="muted">
            กด Tab ไปช่องถัดไป · Enter ลงห้องถัดไป · เลขทศนิยมได้ 3 ตำแหน่ง
          </p>
        </div>
        <div className="actions">
          <button
            className="secondary"
            disabled={saving || dirty.size === 0}
            onClick={save}
          >
            {saving
              ? "กำลังบันทึก…"
              : `บันทึกมิเตอร์${dirty.size ? " (" + dirty.size + ")" : ""}`}
          </button>
          <button
            className="primary"
            disabled={busy || saving || dirty.size > 0 || savedReady === 0}
            onClick={onDraft}
          >
            {busy ? "กำลังสร้าง…" : `สร้างบิลร่าง (${savedReady})`}
          </button>
        </div>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {dirty.size > 0 && (
        <p className="hint padded">
          มี {dirty.size} ห้องที่ยังไม่บันทึก
          กรุณาบันทึกก่อนสร้างบิลหรือเปลี่ยนหน้า
        </p>
      )}
      {rooms.length === 0 ? (
        <Empty title="ยังไม่มีห้องที่พร้อมจดมิเตอร์">
          เพิ่มห้องและผู้เช่าในเมนูห้องและผู้เช่าก่อน
        </Empty>
      ) : (
        <div className="table-scroll">
          <table className="meter-table">
            <thead>
              <tr>
                <th>ห้อง</th>
                {p.water_method === "meter" && (
                  <>
                    <th>น้ำ / ครั้งก่อน</th>
                    <th>น้ำ / ครั้งนี้</th>
                  </>
                )}
                <th>ไฟ / ครั้งก่อน</th>
                <th>ไฟ / ครั้งนี้</th>
                <th>ยอดประมาณ</th>
                <th>ตรวจสอบ</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room, index) => {
                const row = rows[room.id],
                  last = previous(room.id),
                  isLocked = locked(room.id);
                if (!row) return null;
                const wu =
                    p.water_method === "flat"
                      ? 1
                      : usage(row.water_previous, row.water_current),
                  eu = usage(row.electric_previous, row.electric_current);
                const invalid =
                  keys.some(
                    (k) =>
                      row[k] !== "" &&
                      (!Number.isFinite(Number(row[k])) || Number(row[k]) < 0),
                  ) ||
                  (row.electric_current !== "" &&
                    row.electric_previous !== "" &&
                    Number(row.electric_current) <
                      Number(row.electric_previous)) ||
                  (p.water_method === "meter" &&
                    row.water_current !== "" &&
                    row.water_previous !== "" &&
                    Number(row.water_current) < Number(row.water_previous));
                const missing = wu === null || eu === null,
                  warn =
                    (eu ?? 0) > 500 ||
                    (p.water_method === "meter" && (wu ?? 0) > 50);
                const amount =
                  (room.rent ?? p.rent) +
                  lineTotal(wu ?? 0, room.water_rate ?? p.water_rate) +
                  lineTotal(eu ?? 0, room.electric_rate ?? p.electric_rate) +
                  data.charges
                    .filter((c) => c.property_id === p.id)
                    .reduce((s, c) => s + c.amount, 0);
                return (
                  <tr
                    key={room.id}
                    className={
                      isLocked ? "locked" : invalid ? "invalid-row" : ""
                    }
                  >
                    <td>
                      <strong className="room-link">{room.name}</strong>
                      <small>ชั้น {room.floor || "—"}</small>
                    </td>
                    {keys.map((key) => {
                      const inherited =
                        key === "water_previous"
                          ? last?.water_current
                          : key === "electric_previous"
                            ? last?.electric_current
                            : null;
                      return (
                        <td key={key}>
                          <label className="sr-only" htmlFor={room.id + key}>
                            ห้อง {room.name}{" "}
                            {key.startsWith("water") ? "น้ำ" : "ไฟ"}{" "}
                            {key.endsWith("previous")
                              ? "ครั้งก่อน"
                              : "ครั้งนี้"}
                          </label>
                          <div className="meter-reading">
                          <input
                            id={room.id + key}
                            data-row={index}
                            data-column={key}
                            aria-invalid={invalid}
                            disabled={isLocked || saving}
                            readOnly={inherited != null}
                            type="number"
                            min="0"
                            max="999999999"
                            step="0.001"
                            inputMode="decimal"
                            placeholder="—"
                            value={row[key]}
                            onChange={(e) => {
                              setRows({
                                ...rows,
                                [room.id]: { ...row, [key]: e.target.value },
                              });
                              setDirty(new Set([...dirty, room.id]));
                              onDirty(true);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                document
                                  .querySelector<HTMLInputElement>(
                                    `input[data-row="${index + 1}"][data-column="${key}"]`,
                                  )
                                  ?.focus();
                              }
                            }}
                          />
                          {key.endsWith("current") && (
                            <small className="meter-usage">
                              {(key.startsWith("water") ? wu : eu) ?? "—"} หน่วย
                            </small>
                          )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="number">
                      {missing ? "—" : "฿" + money(amount)}
                    </td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (isLocked
                            ? "paid"
                            : invalid
                              ? "overdue"
                              : missing
                                ? "draft"
                                : warn
                                  ? "slip_submitted"
                                  : "vacant")
                        }
                      >
                        {isLocked
                          ? "มีบิลแล้ว"
                          : invalid
                            ? "เลขมิเตอร์ไม่ถูกต้อง"
                            : missing
                              ? "ข้อมูลไม่ครบ"
                              : warn
                                ? "หน่วยสูง ตรวจอีกครั้ง"
                                : "พร้อมออกบิล"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-foot">
        <span>
          น้ำ {p.water_method === "flat" ? "เหมาจ่าย" : "ตามหน่วย"} · ไฟตามหน่วย
        </span>
        <span>บิลที่สร้างแล้วจะล็อกมิเตอร์ของห้องนั้น</span>
      </div>
    </section>
  );
}
