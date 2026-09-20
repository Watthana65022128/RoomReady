"use server";
import { owner } from "@/lib/data";
import { isPlan } from "@/lib/plans";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/domain";
export async function requestPlan(
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const plan = form.get("plan");
  if (!isPlan(plan)) return { message: "แพ็กเกจไม่ถูกต้อง" };
  const { db } = await owner();
  const { error } = await db.rpc("request_subscription", {
    requested_plan: plan,
  });
  if (error) return { message: "ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง" };
  revalidatePath("/subscription");
  revalidatePath("/admin/subscriptions");
  return {
    ok: true,
    message:
      "ส่งคำขอแล้ว รอแอดมินยืนยันหลังรับชำระเงิน โควตาจะเปลี่ยนเมื่อยืนยันสำเร็จ",
  };
}
export async function approvePlan(
  _state: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const plan = form.get("plan"),
    requestId = String(form.get("request_id") || "");
  if (!isPlan(plan) || !/^[0-9a-f-]{36}$/i.test(requestId))
    return { message: "ข้อมูลไม่ถูกต้อง" };
  if (form.get("payment_confirmed") !== "yes")
    return { message: "กรุณายืนยันว่าตรวจสอบการรับชำระเงินแล้ว" };
  const { db } = await owner();
  // The RPC reads the admin role from auth.users, never user-editable metadata.
  const { error } = await db.rpc("approve_subscription", {
    request_id: requestId,
    selected_plan: plan,
  });
  if (error)
    return {
      message: /[ก-๙]/.test(error.message)
        ? error.message
        : "ยืนยันไม่สำเร็จ กรุณาลองใหม่",
    };
  revalidatePath("/admin/subscriptions");
  revalidatePath("/subscription");
  revalidatePath("/dashboard");
  return { ok: true, message: "ยืนยันสิทธิ์ 1 เดือนและบันทึกประวัติแล้ว" };
}
