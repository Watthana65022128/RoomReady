import "server-only";
import { getSupabaseEnv } from "./supabase/env";
export async function billGateway(token: string, init?: RequestInit) {
  const { url, publishableKey } = getSupabaseEnv();
  return fetch(
    url + "/functions/v1/bill-gateway?token=" + encodeURIComponent(token),
    {
      ...init,
      cache: "no-store",
      headers: { apikey: publishableKey, ...init?.headers },
      signal: AbortSignal.timeout(30000),
    },
  );
}
