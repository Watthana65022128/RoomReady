import { test } from "node:test";
import assert from "node:assert/strict";
import { lineTotal, usage, billStatus, today } from "../src/lib/domain.ts";
test("round money at the line level with decimal units", () => {
  assert.equal(lineTotal(2.345, 18), 42.21);
  assert.equal(lineTotal(1.005, 1), 1.01);
  assert.equal(lineTotal(20, 7) + lineTotal(2.345, 18) + 4000 + 200, 4382.21);
  assert.equal(lineTotal(0, 7), 0);
});
test("meter validation treats missing and zero differently", () => {
  assert.equal(usage("", 0), null);
  assert.equal(usage(null, 10), null);
  assert.equal(usage(20, 19), null);
  assert.equal(usage(-1, 10), null);
  assert.equal(usage(0, 0), 0);
  assert.equal(usage(10, 12.345), 2.345);
  assert.equal(usage("oops", 10), null);
  assert.equal(usage(0, "1e308"), null);
  assert.equal(usage(0, Infinity), null);
  assert.equal(lineTotal(Infinity, 7), 0);
});
test("overdue is derived in Bangkok, review and paid states are preserved", () => {
  assert.equal(
    billStatus({ status: "issued", due_date: "2026-09-05" }, "2026-09-06"),
    "overdue",
  );
  assert.equal(
    billStatus({ status: "issued", due_date: "2026-09-05" }, "2026-09-05"),
    "issued",
  );
  assert.equal(
    billStatus(
      { status: "slip_submitted", due_date: "2026-09-05" },
      "2026-09-06",
    ),
    "slip_submitted",
  );
  assert.equal(
    billStatus({ status: "paid", due_date: "2026-09-05" }, "2026-09-06"),
    "paid",
  );
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
});
