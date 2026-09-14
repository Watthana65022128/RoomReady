"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Json } from "@/types/database";
import type { ActionResult } from "@/lib/domain";

const operations = new Set([
  "property_save",
  "rooms_add",
  "room_save",
  "tenant_movein",
  "tenant_moveout",
  "meters_save",
  "drafts_create",
  "issue_all",
  "invoice_edit",
  "draft_delete",
  "invoice_void",
  "payment_confirm",
  "payment_revoke",
  "link_renew",
]);
export async function command(op: string, p: Json): Promise<ActionResult> {
  if (
    !operations.has(op) ||
    !p ||
    Array.isArray(p) ||
    typeof p !== "object" ||
    JSON.stringify(p).length > 180000
  )
    return { message: "ข้อมูลไม่ถูกต้อง" };
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  // IDs in input select a resource; identity always comes from the verified session.
  for (const key of ["id", "property_id", "room_id"]) {
    if (
      p[key] &&
      (typeof p[key] !== "string" || !/^[0-9a-f-]{36}$/i.test(p[key] as string))
    )
      return { message: "ข้อมูลอ้างอิงไม่ถูกต้อง" };
  }
  const { data, error } = await db.rpc("owner_command", { op, p });
  if (error) {
    const message =
      error.code === "23505"
        ? "มีห้องหรือรอบบิลนี้อยู่แล้ว"
        : error.code === "23514"
          ? "กรุณาตรวจตัวเลข วันที่ และรายการที่กรอก"
          : /[ก-๙]/.test(error.message)
            ? error.message
            : "บันทึกไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง";
    return { message };
  }
  revalidatePath("/");
  const result = data as { id?: string; count?: number };
  return {
    ok: true,
    message:
      typeof result.count === "number" &&
      ["drafts_create", "issue_all"].includes(op)
        ? `สำเร็จ ${result.count} บิล`
        : "บันทึกเรียบร้อย",
    ...result,
  };
}
export async function authAction(
  mode: string,
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const db = await createClient();
  const email = String(form.get("email") || "").trim(),
    password = String(form.get("password") || "");
  if (!["login", "signup", "forgot", "reset"].includes(mode))
    return { message: "คำขอไม่ถูกต้อง" };
  if (mode !== "reset" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { message: "กรุณากรอกอีเมลให้ถูกต้อง" };
  if (mode !== "forgot" && password.length < 8)
    return { message: "รหัสผ่านอย่างน้อย 8 ตัวอักษร" };
  const origin =
    process.env.APP_URL ||
    (await headers()).get("origin") ||
    "http://localhost:3000";
  if (mode === "forgot") {
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: origin + "/auth/callback?next=/reset-password",
    });
    return error
      ? { message: "ส่งอีเมลไม่สำเร็จ กรุณาลองอีกครั้ง" }
      : {
          ok: true,
          message: "หากมีบัญชีนี้ ระบบจะส่งลิงก์ตั้งรหัสผ่านไปทางอีเมล",
        };
  }
  if (mode === "reset") {
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { message: "ลิงก์หมดอายุ กรุณาขอลิงก์ใหม่" };
    const { error } = await db.auth.updateUser({ password });
    if (error) return { message: "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาขอลิงก์ใหม่" };
    redirect("/");
  }
  if (mode === "signup") {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: origin + "/auth/callback" },
    });
    if (error)
      return { message: "สมัครไม่สำเร็จ กรุณาตรวจอีเมลและลองอีกครั้ง" };
    if (!data.session)
      return {
        ok: true,
        message: "ตรวจอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ",
      };
  } else {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) return { message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }
  redirect("/");
}
export async function logout() {
  const db = await createClient();
  await db.auth.signOut();
  redirect("/login");
}
