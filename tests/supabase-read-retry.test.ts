import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { readWithJwtRetry } from "../src/lib/supabase/read-retry.ts";

const futureJwt = {
  status: 401,
  data: null,
  error: { code: "PGRST303", message: "JWT issued at future" },
};
const success = { status: 200, data: [{ id: "reading" }], error: null };

test("a successful read returns data without waiting", async () => {
  const result = await readWithJwtRetry(
    () => Promise.resolve(success),
    "test.read",
    async () => assert.fail("successful reads should not wait"),
  );
  assert.equal(result, success);
});

test("a freshly issued JWT recovers when the server clock catches up", async (t) => {
  const warnings = t.mock.method(console, "warn", () => {});
  const delays: number[] = [];
  let calls = 0;
  const result = await readWithJwtRetry(
    () => Promise.resolve(++calls < 3 ? futureJwt : success),
    "workspace.meter_readings",
    async (ms) => { delays.push(ms); },
  );
  assert.equal(result, success);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [500, 1000]);
  assert.equal(warnings.mock.callCount(), 2);
});

test("persistent clock skew stops after a bounded retry budget", async (t) => {
  t.mock.method(console, "warn", () => {});
  const delays: number[] = [];
  let calls = 0;
  const result = await readWithJwtRetry(
    () => { calls++; return Promise.resolve(futureJwt); },
    "test.read",
    async (ms) => { delays.push(ms); },
  );
  assert.equal(result, futureJwt);
  assert.equal(calls, 4);
  assert.deepEqual(delays, [500, 1000, 2000]);
});

test("expired tokens, permission errors and other failures are not retried", async () => {
  for (const failure of [
    { ...futureJwt, error: { code: "PGRST303", message: "JWT expired" } },
    { ...futureJwt, error: { code: "PGRST301", message: "Invalid JWT" } },
    { ...futureJwt, status: 403, error: { code: "42501", message: "permission denied" } },
    { ...futureJwt, status: 500 },
  ]) {
    let calls = 0;
    const result = await readWithJwtRetry(
      () => { calls++; return Promise.resolve(failure); },
      "test.read",
      async () => assert.fail("unrelated failures should not wait"),
    );
    assert.equal(result, failure);
    assert.equal(calls, 1);
  }
});

test("a query exception is preserved", async () => {
  const error = new Error("query failed");
  await assert.rejects(
    readWithJwtRetry(
      () => Promise.reject(error),
      "test.read",
      async () => assert.fail("exceptions should not wait"),
    ),
    (actual) => actual === error,
  );
});

test("Supabase queries are rebuilt on retry and preserve owner filters", async (t) => {
  t.mock.method(console, "warn", () => {});
  for (const single of [false, true]) {
    const requests: URL[] = [];
    const db = createClient("https://example.supabase.co", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input) => {
          requests.push(new URL(String(input)));
          return new Response(
            JSON.stringify(requests.length === 1 ? futureJwt.error : single ? { owner_id: "owner" } : success.data),
            { status: requests.length === 1 ? 401 : 200, headers: { "Content-Type": "application/json" } },
          );
        },
      },
    });
    const result = await readWithJwtRetry(
      () => {
        const query = db.from(single ? "owner_subscriptions" : "meter_readings")
          .select("*").eq("owner_id", "owner");
        return single ? query.single() : query.order("id").range(0, 999);
      },
      "test.sdk",
      async () => {},
    );
    assert.equal(result.error, null);
    assert.deepEqual(result.data, single ? { owner_id: "owner" } : success.data);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].href, requests[1].href);
    assert.equal(requests[1].searchParams.get("owner_id"), "eq.owner");
  }
});
