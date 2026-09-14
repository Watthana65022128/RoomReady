// Only removes this implementation's disposable QA account storage.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
nextEnv.loadEnvConfig(process.cwd());
const uid = "8b1cd8a0-37b3-4bf1-87ae-c81723327915";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const { data, error } = await db.auth.signInWithPassword({
  email: "horprom-qa@example.invalid",
  password: process.argv[2],
});
if (error || data.user.id !== uid) throw new Error("QA identity mismatch");
const { data: slips, error: readError } = await db
  .from("payment_submissions")
  .select("path")
  .eq("owner_id", uid);
if (readError) throw readError;
const paths = slips.map((s) => s.path);
if (paths.some((p) => !p.startsWith(uid + "/")))
  throw new Error("Unsafe cleanup path");
if (paths.length) {
  const { error } = await db.storage.from("slips").remove(paths);
  if (error) throw error;
}
await db.auth.signOut({ scope: "global" });
console.log(
  "Removed " + paths.length + " synthetic QA slip files; revoked QA sessions.",
);
