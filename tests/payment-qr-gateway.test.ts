import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function gateway({ exists = true, hasQr = true, signError = false } = {}) {
  const calls: unknown[][] = [];
  let handler: (req: Request) => Promise<Response>;
  const invoice = {
    id: "invoice",
    owner_id: "owner",
    property_id: "property",
    token_expires_at: new Date(Date.now() + 120000).toISOString(),
    total: 101,
  };
  const db = {
    from(table: string) {
      const builder = {
        select() {
          return builder;
        },
        eq(key: string, value: unknown) {
          calls.push(["eq", table, key, value]);
          return builder;
        },
        gt(key: string, value: unknown) {
          calls.push(["gt", key, value]);
          return builder;
        },
        not(key: string, op: string, value: unknown) {
          calls.push(["not", key, op, value]);
          return builder;
        },
        async maybeSingle() {
          return { data: exists ? invoice : null, error: null };
        },
        async order() {
          return { data: [], error: null };
        },
      };
      return builder;
    },
    storage: {
      from(bucket: string) {
        calls.push(["bucket", bucket]);
        return {
          async list(folder: string) {
            calls.push(["list", folder]);
            return { data: hasQr ? [{ name: "qr" }] : [], error: null };
          },
          async createSignedUrl(path: string, seconds: number) {
            calls.push(["sign", path, seconds]);
            return {
              data: { signedUrl: "https://storage.example/signed-qr" },
              error: signError ? new Error("Unavailable") : null,
            };
          },
        };
      },
    },
  };
  const source = fs.readFileSync(
    "supabase/functions/bill-gateway/index.ts",
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports: {},
    require: () => ({ createClient: () => db }),
    Deno: {
      env: { get: () => "" },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
    Response,
    Request,
    URL,
    Date,
    console: { error() {} },
    TextDecoder,
    Uint8Array,
    File,
    crypto,
  });
  return {
    request: (token = "a".repeat(64)) =>
      handler(new Request("https://test.example/?token=" + token)),
    calls,
  };
}
test("gateway only signs QR after valid non-draft non-void unexpired token lookup", async () => {
  const g = gateway();
  const response = await g.request();
  assert.equal(response.status, 200);
  assert.equal(
    (await response.json()).payment_qr_url,
    "https://storage.example/signed-qr",
  );
  assert.ok(g.calls.some((c) => c[0] === "not" && c[3] === "(draft,void)"));
  assert.ok(g.calls.some((c) => c[0] === "gt" && c[1] === "token_expires_at"));
  const sign = g.calls.find((c) => c[0] === "sign")!;
  assert.equal(sign[1], "owner/property/qr");
  assert.ok(Number(sign[2]) > 0 && Number(sign[2]) <= 120);
});
test("gateway rejects invalid or unavailable tokens before storage access", async () => {
  for (const token of ["invalid", "a".repeat(64)]) {
    const g = gateway({ exists: false });
    assert.equal((await g.request(token)).status, 404);
    assert.ok(!g.calls.some((c) => c[0] === "bucket"));
  }
});
test("bills without a QR still load with unchanged amount", async () => {
  const g = gateway({ hasQr: false });
  const response = await g.request();
  assert.equal(response.status, 200);
  const bill = await response.json();
  assert.equal(bill.payment_qr_url, null);
  assert.equal(bill.total, 101);
  assert.ok(!g.calls.some((c) => c[0] === "sign"));
});
test("gateway reports signing failure instead of sending a broken QR", async () => {
  const g = gateway({ signError: true });
  assert.equal((await g.request()).status, 500);
});
