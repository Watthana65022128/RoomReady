import type { Tables, Enums } from "@/types/database";

export const money = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const monthLabel = (date: string) =>
  new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(date + "T00:00:00+07:00"));
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(date.length === 10 ? date + "T00:00:00+07:00" : date));
export function billStatus(
  i: { status: Enums<"invoice_status">; due_date: string },
  day = today(),
): Enums<"invoice_status"> {
  return i.status === "issued" && i.due_date < day ? "overdue" : i.status;
}
export const statusText: Record<Enums<"invoice_status">, string> = {
  draft: "ร่าง",
  issued: "รอชำระ",
  slip_submitted: "รอตรวจสลิป",
  paid: "จ่ายแล้ว",
  overdue: "เกินกำหนด",
  void: "ยกเลิก",
};
export function lineTotal(quantity: number, rate: number) {
  if (!Number.isFinite(quantity * 1000) || !Number.isFinite(rate * 100) || quantity < 0 || rate < 0) return 0;
  // Same decimal scales as Postgres: units in thousandths, rates in satang.
  return (
    Number(
      (BigInt(Math.round(quantity * 1000)) * BigInt(Math.round(rate * 100)) +
        BigInt(500)) /
        BigInt(1000),
    ) / 100
  );
}
export function usage(
  previous: string | number | null,
  current: string | number | null,
) {
  if (
    previous === "" ||
    current === "" ||
    previous === null ||
    current === null
  )
    return null;
  const p = Number(previous),
    c = Number(current);
  if (!Number.isFinite(p) || !Number.isFinite(c) || p < 0 || c < p || c > 999999999.999) return null;
  return Math.round((c - p) * 1000) / 1000;
}
export type Workspace = {
  properties: Tables<"properties">[];
  rooms: Tables<"rooms">[];
  tenants: Tables<"tenants">[];
  tenancies: Tables<"tenancies">[];
  charges: Tables<"charge_templates">[];
  cycles: Tables<"billing_cycles">[];
  readings: Tables<"meter_readings">[];
  invoices: Tables<"invoices">[];
};
export type ActionResult = {
  ok?: boolean;
  message: string;
  id?: string;
  count?: number;
};
export type PublicBill = Pick<
  Tables<"invoices">,
  | "property_name"
  | "room_name"
  | "tenant_name"
  | "month"
  | "due_date"
  | "status"
  | "total"
  | "payment_info"
  | "paid_at"
> & {
  payment_qr_url?: string | null;
  items: Pick<
    Tables<"invoice_items">,
    | "label"
    | "kind"
    | "quantity"
    | "rate"
    | "amount"
    | "previous_reading"
    | "current_reading"
  >[];
};

export type GroupPublicBill = Omit<PublicBill, "tenant_name">;
export type GroupBillListing = {
  property_name: string;
  bills: { id: string; room_name: string; month: string }[];
};
