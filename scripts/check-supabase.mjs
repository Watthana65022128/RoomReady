import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Missing Supabase environment variables.");

for (const path of ["/auth/v1/settings"]) {
  const response = await fetch(new URL(path, url), {
    headers: { apikey: key },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Supabase ${path}: HTTP ${response.status}`);
  console.log(`PASS ${path}: HTTP ${response.status}`);
}
console.log("Supabase connection verified.");
