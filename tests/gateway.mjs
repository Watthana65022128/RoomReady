import assert from "node:assert/strict";
const base = process.env.QA_BASE_URL || "http://localhost:3100";
const token = process.argv[2];
if (!token || !/^[a-f0-9]{64}$/.test(token))
  throw new Error("Pass a disposable QA invoice token");
const path = base + "/api/b/" + token + "/slip";
async function upload(bytes, type) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), "qa-slip.png");
  return fetch(path, { method: "POST", body: form });
}
const invalid = await fetch(base + "/b/" + "0".repeat(64));
// Next.js may stream a not-found UI with HTTP 200 after a loading boundary.
assert.match(await invalid.text(), /ไม่พบบิลหรือลิงก์หมดอายุ/);
const invalidUpload = await fetch(base + "/api/b/" + "0".repeat(64) + "/slip", {
  method: "POST",
  body: new FormData(),
});
assert.equal(invalidUpload.status, 404);
const page = await fetch(base + "/b/" + token);
assert.equal(page.status, 200);
assert.match(await page.text(), /4,382\.21/);
const fake = await upload(
  new TextEncoder().encode("not a real image"),
  "image/png",
);
assert.equal(fake.status, 400);
const large = await upload(new Uint8Array(5242881), "image/png");
assert.ok([400, 413].includes(large.status));
// Tiny, synthetic PNG fixture. Contains no real bank information.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const upload1 = await upload(png, "image/png");
assert.equal(upload1.status, 200, await upload1.text());
const replacement = await upload(png, "image/png");
assert.equal(replacement.status, 200, await replacement.text());
const after = await fetch(base + "/b/" + token);
assert.match(await after.text(), /ได้รับสลิปแล้ว/);
console.log(
  "PASS: public bill, invalid token, spoofed type, oversized file, upload, replacement, and review state.",
);
