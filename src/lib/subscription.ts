import "server-only";
import { owner } from "@/lib/data";
import { subscriptionAccess } from "@/lib/plans";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
export async function readSubscription(
  db: SupabaseClient<Database>,
  ownerId: string,
) {
  const { data, error } = await db
    .from("owner_subscriptions")
    .select("*")
    .eq("owner_id", ownerId)
    .single();
  if (error || !data) throw new Error("โหลดแพ็กเกจไม่สำเร็จ กรุณาลองอีกครั้ง");
  return data;
}
export async function requireActiveSubscription(
  db: SupabaseClient<Database>,
  ownerId: string,
) {
  if (!subscriptionAccess(await readSubscription(db, ownerId)).active)
    throw new Error(
      "สิทธิ์ใช้งานหมดอายุแล้ว ดูข้อมูลเดิมได้ กรุณาขอเปิดใช้แพ็กเกจ",
    );
}
export async function subscriptionContext() {
  const { db, user } = await owner();
  return { db, user, subscription: await readSubscription(db, user.id) };
}
