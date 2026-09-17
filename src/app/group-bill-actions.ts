"use server";
import { randomBytes } from "node:crypto";
import { owner } from "@/lib/data";

export async function propertyBillLink(propertyId: string, rotate = false) {
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) throw new Error("ไม่พบหอพัก");
  const { db, user } = await owner();
  const { data: property, error } = await db
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error || !property) throw new Error("ไม่พบหอพัก");
  if (rotate) {
    const { data, error } = await db
      .from("property_bill_links")
      .update({ token: randomBytes(32).toString("hex") })
      .eq("property_id", propertyId)
      .select("token")
      .single();
    if (error) throw new Error("เปลี่ยนลิงก์ไม่สำเร็จ กรุณาลองใหม่");
    return data.token;
  }
  const { error: insertError } = await db
    .from("property_bill_links")
    .upsert(
      { property_id: propertyId, token: randomBytes(32).toString("hex") },
      { onConflict: "property_id", ignoreDuplicates: true },
    );
  if (insertError) throw new Error("สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่");
  const { data, error: readError } = await db
    .from("property_bill_links")
    .select("token")
    .eq("property_id", propertyId)
    .single();
  if (readError) throw new Error("โหลดลิงก์ไม่สำเร็จ กรุณาลองใหม่");
  return data.token;
}
