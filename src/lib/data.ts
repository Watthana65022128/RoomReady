import "server-only";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Tables } from "@/types/database";
import type { Workspace } from "@/lib/domain";

export async function owner() {
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/login");
  return { db, user };
}
export async function workspace(): Promise<Workspace> {
  const { db, user } = await owner();
  type OwnerTable =
    | "properties"
    | "rooms"
    | "tenants"
    | "tenancies"
    | "charge_templates"
    | "billing_cycles"
    | "meter_readings"
    | "invoices";
  async function rows<
    T extends
      | Exclude<keyof Workspace, "charges" | "cycles" | "readings">
      | "charge_templates"
      | "billing_cycles"
      | "meter_readings",
  >(table: T) {
    const result: Tables<T>[] = [];
    for (let offset = 0; ; offset += 1000) {
      const startedAt = Date.now();
      const { data, error, status } = await db
        .from(table as OwnerTable)
        .select("*")
        .eq("owner_id", user.id)
        .order("id")
        .range(offset, offset + 999);
      if (error) {
        console.error("[workspace.rows] Failed to load data", {
          table,
          offset,
          limit: 1000,
          status,
          code: error.code,
          message: error.message
            .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
            .replace(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted token]")
            .replace(/https?:\/\/\S+/g, "[redacted URL]")
            .slice(0, 2000),
          durationMs: Date.now() - startedAt,
        });
        throw new Error("โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
      const page = data as unknown as Tables<T>[];
      result.push(...page);
      if (page.length < 1000) break;
    }
    return result;
  }
  const [
    properties,
    rooms,
    tenants,
    tenancies,
    charges,
    cycles,
    readings,
    invoices,
  ] = await Promise.all([
    rows("properties"),
    rows("rooms"),
    rows("tenants"),
    rows("tenancies"),
    rows("charge_templates"),
    rows("billing_cycles"),
    rows("meter_readings"),
    rows("invoices"),
  ]);
  return {
    properties,
    rooms,
    tenants,
    tenancies,
    charges,
    cycles,
    readings,
    invoices,
  };
}
