import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const groupToken = "a".repeat(64);
const invoiceId = "11111111-1111-4111-8111-111111111111";
const makeInvoice = (overrides = {}) => ({
  id: invoiceId,
  owner_id: "owner",
  property_id: "property",
  token: "b".repeat(64),
  token_expires_at: "2099-01-01T00:00:00Z",
  property_name: "Test dorm",
  room_name: "201",
  tenant_name: "PRIVATE TENANT",
  month: "2026-09-01",
  due_date: "2026-10-05",
  status: "issued",
  total: 5000,
  payment_info: "Bank payment",
  paid_at: null,
  ...overrides,
});
function gateway({
  invoices = [makeInvoice()],
  activeToken = groupToken,
  count = 0,
  finalizeError = false,
} = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    property_bill_links: [{ property_id: "property", token: activeToken }],
    properties: [{ id: "property", owner_id: "owner", name: "Test dorm" }],
    invoices,
    invoice_items: [
      {
        invoice_id: invoiceId,
        label: "Rent",
        kind: "rent",
        quantity: 1,
        rate: 5000,
        amount: 5000,
        previous_reading: null,
        current_reading: null,
        owner_id: "PRIVATE OWNER",
      },
    ],
    payment_submissions: [],
  };
  const calls: unknown[][] = [];
  const db = {
    from(table: string) {
      let rows = [...(tables[table] || [])];
      let columns = "*";
      const result = () => ({
        data: rows.map((row) =>
          columns === "*"
            ? row
            : Object.fromEntries(columns.split(",").map((k) => [k, row[k]])),
        ),
        error: null,
        count,
      });
      const b = {
        select(value: string) {
          columns = value;
          return b;
        },
        eq(k: string, value: unknown) {
          rows = rows.filter((r) => r[k] === value);
          return b;
        },
        gt(k: string, value: string) {
          rows = rows.filter((r) => String(r[k]) > value);
          return b;
        },
        not(k: string, _op: string, values: string) {
          rows = rows.filter(
            (r) => !values.slice(1, -1).split(",").includes(String(r[k])),
          );
          return b;
        },
        order() {
          return b;
        },
        range(start: number, end: number) {
          rows = rows.slice(start, end + 1);
          return b;
        },
        async maybeSingle() {
          return { data: result().data[0] || null, error: null };
        },
        then(resolve: (v: ReturnType<typeof result>) => unknown) {
          return Promise.resolve(result()).then(resolve);
        },
      };
      return b;
    },
    storage: {
      from(bucket: string) {
        calls.push(["bucket", bucket]);
        return {
          async list() {
            return { data: [{ name: "qr" }], error: null };
          },
          async createSignedUrl(path: string) {
            calls.push(["sign", path]);
            return {
              data: { signedUrl: "https://example.test/qr" },
              error: null,
            };
          },
          async upload(path: string, _bytes: unknown, options: unknown) {
            calls.push(["upload", path, options]);
            return { error: null };
          },
          async remove(paths: string[]) {
            calls.push(["remove", paths]);
            return { error: null };
          },
        };
      },
    },
    async rpc(name: string, args: unknown) {
      calls.push(["rpc", name, args]);
      return { error: finalizeError ? { message: "Link rotated" } : null };
    },
  };
  let handler!: (req: Request) => Promise<Response>;
  const code = ts.transpileModule(
    fs.readFileSync("supabase/functions/bill-gateway/index.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports: {},
    require: () => ({ createClient: () => db }),
    Deno: {
      env: { get: () => "" },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
    Request,
    Response,
    URL,
    Date,
    File,
    Uint8Array,
    TextDecoder,
    crypto,
    console: { error() {} },
  });
  return {
    calls,
    request: (query = "group_token=" + groupToken, init?: RequestInit) =>
      handler(new Request("https://test.example/?" + query, init)),
  };
}
const detail = "group_token=" + groupToken + "&invoice_id=" + invoiceId;
const upload = () => {
  const form = new FormData();
  form.set(
    "file",
    new File(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])],
      "slip.png",
      { type: "image/png" },
    ),
  );
  return { method: "POST", body: form };
};
test("group directory lists only issued non-void unexpired bills in its own property", async () => {
  const g = gateway({
    invoices: [
      makeInvoice(),
      makeInvoice({ id: "draft", status: "draft" }),
      makeInvoice({ id: "void", status: "void" }),
      makeInvoice({ id: "expired", token_expires_at: "2000-01-01" }),
      makeInvoice({ id: "other", property_id: "other-property" }),
      makeInvoice({ id: "wrong-owner", owner_id: "other-owner" }),
    ],
  });
  const r = await g.request();
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), {
    property_name: "Test dorm",
    bills: [{ id: invoiceId, room_name: "201", month: "2026-09-01" }],
  });
  assert.equal(g.calls.length, 0);
});
test("directory handles 50 rooms and paginates larger histories without exposing identity", async () => {
  for (const n of [50, 1001]) {
    const g = gateway({
      invoices: Array.from({ length: n }, (_, i) =>
        makeInvoice({ id: String(i), room_name: String(101 + i) }),
      ),
    });
    const data = await (await g.request()).json();
    assert.equal(data.bills.length, n);
    assert.ok(
      data.bills.every(
        (b: object) => Object.keys(b).sort().join(",") === "id,month,room_name",
      ),
    );
  }
});
test("empty property has a valid empty directory", async () => {
  const g = gateway({ invoices: [] });
  assert.deepEqual((await (await g.request()).json()).bills, []);
});
test("group detail excludes private tenant name, invoice token, and internal IDs", async () => {
  const g = gateway();
  const r = await g.request(detail);
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.total, 5000);
  assert.equal(data.payment_qr_url, "https://example.test/qr");
  for (const key of [
    "tenant_name",
    "token",
    "owner_id",
    "property_id",
    "slips",
    "events",
  ])
    assert.ok(!(key in data));
  assert.ok(!JSON.stringify(data).includes("PRIVATE"));
  assert.ok(
    g.calls.some((c) => c[0] === "sign" && c[1] === "owner/property/qr"),
  );
});
test("rotation invalidates old group links for list, detail, and upload", async () => {
  const g = gateway({ activeToken: "c".repeat(64) });
  assert.equal((await g.request()).status, 404);
  assert.equal((await g.request(detail)).status, 404);
  assert.equal((await g.request(detail, upload())).status, 404);
  assert.equal(g.calls.length, 0);
});
test("group token cannot open or upload to a different property, draft, void or expired bill", async () => {
  for (const patch of [
    { property_id: "other" },
    { owner_id: "other" },
    { status: "draft" },
    { status: "void" },
    { token_expires_at: "2000-01-01" },
  ]) {
    const g = gateway({ invoices: [makeInvoice(patch)] });
    assert.equal((await g.request(detail)).status, 404);
    assert.equal((await g.request(detail, upload())).status, 404);
    assert.equal(g.calls.length, 0);
  }
});
test("malformed tokens and invoice IDs are rejected", async () => {
  const g = gateway();
  for (const query of [
    "group_token=bad",
    "group_token=" + groupToken + "&invoice_id=bad",
  ]) {
    assert.equal((await g.request(query)).status, 404);
  }
  assert.equal((await g.request(undefined, upload())).status, 400);
});
test("group upload uses scoped finalization and appends unique slip objects", async () => {
  const g = gateway();
  assert.equal((await g.request(detail, upload())).status, 200);
  assert.equal((await g.request(detail, upload())).status, 200);
  const uploads = g.calls.filter((c) => c[0] === "upload");
  assert.equal(uploads.length, 2);
  assert.notEqual(uploads[0][1], uploads[1][1]);
  assert.equal((uploads[0][2] as { upsert: boolean }).upsert, false);
  const rpc = g.calls.find((c) => c[0] === "rpc")!;
  assert.equal(rpc[1], "submit_group_slip");
  assert.equal((rpc[2] as { group_token: string }).group_token, groupToken);
  assert.equal((rpc[2] as { invoice_id: string }).invoice_id, invoiceId);
  assert.ok(!g.calls.some((c) => c[0] === "remove"));
});
test("finalization failure cleans up only the newly uploaded object", async () => {
  const g = gateway({ finalizeError: true });
  assert.equal((await g.request(detail, upload())).status, 409);
  const path = g.calls.find((c) => c[0] === "upload")![1];
  assert.equal(
    (g.calls.find((c) => c[0] === "remove")![1] as string[])[0],
    path,
  );
});
test("paid bills reject uploads and rate limit stays in force", async () => {
  assert.equal(
    (
      await gateway({ invoices: [makeInvoice({ status: "paid" })] }).request(
        detail,
        upload(),
      )
    ).status,
    409,
  );
  assert.equal(
    (await gateway({ count: 5 }).request(detail, upload())).status,
    429,
  );
});
test("private bill link remains compatible and includes tenant identity", async () => {
  const g = gateway();
  const r = await g.request("token=" + "b".repeat(64));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).tenant_name, "PRIVATE TENANT");
});
