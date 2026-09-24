import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardHref, safeReturnTo, withReturnTo } from "../src/lib/navigation.ts";

test("dashboard URL keeps the selected billing step and filters", () => {
  const dashboard = dashboardHref({
    tab: "billing",
    month: "2026-09",
    step: "share",
    status: "slip_submitted",
    query: "A 101",
  });
  assert.equal(
    dashboard,
    "/dashboard?tab=billing&month=2026-09&step=share&status=slip_submitted&q=A+101",
  );
  const invoice = withReturnTo(
    "/invoices/12345678-1234-1234-1234-123456789abc",
    dashboard,
  );
  const returnTo = new URL(invoice, "https://example.test").searchParams.get("returnTo");
  assert.equal(safeReturnTo(returnTo || undefined), dashboard);
});

test("return destinations stay inside allowed app pages", () => {
  assert.equal(safeReturnTo("https://other.test/dashboard"), null);
  assert.equal(safeReturnTo("//other.test/dashboard"), null);
  assert.equal(safeReturnTo("/dashboard\\other"), null);
  assert.equal(safeReturnTo("/invoices/12345678-1234-1234-1234-123456789abc"), null);
  assert.equal(
    safeReturnTo("/invoices/12345678-1234-1234-1234-123456789abc?returnTo=%2Fdashboard", true),
    "/invoices/12345678-1234-1234-1234-123456789abc?returnTo=%2Fdashboard",
  );
});
