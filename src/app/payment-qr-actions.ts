"use server";
import { createClient } from "@/lib/supabase/server";
import { paymentQrUrl } from "@/lib/payment-qr";
import { QR_MAX_BYTES, qrImageType } from "@/lib/payment-qr-validation";
import { revalidatePath } from "next/cache";

async function context(propertyId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(propertyId))
    throw new Error("ข้อมูลหอพักไม่ถูกต้อง");
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  const { data, error } = await db
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error || !data) throw new Error("ไม่พบหอพัก");
  return { db, user, path: user.id + "/" + propertyId + "/qr" };
}
export async function readPaymentQr(propertyId: string) {
  const { db, user } = await context(propertyId);
  return paymentQrUrl(db, user.id, propertyId);
}
export async function savePaymentQr(propertyId: string, form: FormData) {
  const { db, path } = await context(propertyId);
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > QR_MAX_BYTES)
    return { ok: false, message: "เลือกรูป QR ขนาดไม่เกิน 2 MB" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = qrImageType(bytes);
  if (!mime || file.type !== mime)
    return { ok: false, message: "รองรับเฉพาะรูป JPG, PNG หรือ WebP" };
  const { error } = await db.storage
    .from("payment-qr")
    .upload(path, bytes, {
      contentType: mime,
      upsert: true,
      cacheControl: "0",
    });
  if (error)
    return { ok: false, message: "บันทึกรูป QR ไม่สำเร็จ กรุณาลองอีกครั้ง" };
  revalidatePath("/", "layout");
  return { ok: true, message: "บันทึกรูป QR เรียบร้อย ลูกหอดูได้จากลิงก์บิล" };
}
export async function removePaymentQr(propertyId: string) {
  const { db, path } = await context(propertyId);
  const { error } = await db.storage.from("payment-qr").remove([path]);
  if (error)
    return { ok: false, message: "ลบรูป QR ไม่สำเร็จ กรุณาลองอีกครั้ง" };
  revalidatePath("/", "layout");
  return { ok: true, message: "ลบรูป QR เรียบร้อย" };
}
