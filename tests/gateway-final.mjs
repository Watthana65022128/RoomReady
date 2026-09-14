import assert from "node:assert/strict";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const base = process.env.QA_BASE_URL || "http://localhost:3100";
const token = process.argv[2];
const page = await fetch(base + "/b/" + token);
assert.match(await page.text(), /รับชำระเรียบร้อยแล้ว/);
const f = new FormData();
f.append("file", new Blob(["fake"], { type: "image/png" }), "qa.png");
const upload = await fetch(base + "/api/b/" + token + "/slip", {
  method: "POST",
  body: f,
});
assert.equal(upload.status, 409);
const raw = await fetch(
  process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/invoices?select=id",
  { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } },
);
assert.ok([401, 403].includes(raw.status));
if (process.argv[3]) {
  const privateFile = await fetch(
    process.env.NEXT_PUBLIC_SUPABASE_URL +
      "/storage/v1/object/public/slips/" +
      process.argv[3],
  );
  assert.notEqual(privateFile.status, 200);
}
console.log(
  "PASS: paid bill blocks uploads; anonymous Data API and public storage are denied.",
);
