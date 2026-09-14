import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next =
    request.nextUrl.searchParams.get("next") === "/reset-password"
      ? "/reset-password"
      : "/";
  if (code) {
    const db = await createClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=expired", request.url));
}
