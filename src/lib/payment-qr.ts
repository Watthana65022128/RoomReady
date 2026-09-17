import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
export async function paymentQrUrl(
  db: SupabaseClient<Database>,
  ownerId: string,
  propertyId: string,
) {
  const bucket = db.storage.from("payment-qr");
  const folder = ownerId + "/" + propertyId;
  const { data: files, error } = await bucket.list(folder, {
    search: "qr",
    limit: 10,
  });
  if (error) throw new Error("โหลดรูป QR ไม่สำเร็จ กรุณาลองอีกครั้ง");
  if (!files.some((file) => file.name === "qr")) return null;
  const { data, error: signError } = await bucket.createSignedUrl(
    folder + "/qr",
    3600,
  );
  if (signError) throw new Error("เปิดรูป QR ไม่สำเร็จ กรุณาลองอีกครั้ง");
  return data.signedUrl;
}
