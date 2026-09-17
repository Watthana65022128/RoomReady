import "server-only";
import { getSupabaseEnv } from "./supabase/env";

export async function groupBillGateway(
  token: string,
  invoiceId?: string,
  init?: RequestInit,
) {
  const { url, publishableKey } = getSupabaseEnv();
  const query = new URLSearchParams({ group_token: token });
  if (invoiceId) query.set("invoice_id", invoiceId);
  return fetch(`${url}/functions/v1/bill-gateway?${query}`, {
    ...init,
    cache: "no-store",
    headers: { apikey: publishableKey, ...init?.headers },
    signal: AbortSignal.timeout(30000),
  });
}
