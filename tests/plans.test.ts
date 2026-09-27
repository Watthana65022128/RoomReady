import test from "node:test";
import assert from "node:assert/strict";
import {
  PLANS,
  TRIAL_DAYS,
  isPlan,
  subscriptionAccess,
  type Subscription,
} from "../src/lib/plans.ts";
const trial: Subscription = {
  owner_id: "test",
  plan: "trial",
  trial_started_at: "2026-09-20T00:00:00Z",
  trial_ends_at: "2026-11-19T00:00:00Z",
  expires_at: null,
};
test("agreed prices and room quotas", () => {
  assert.equal(TRIAL_DAYS, 60);
  assert.deepEqual(
    Object.values(PLANS).map((p) => [p.price, p.rooms]),
    [
      [99, 30],
      [199, 100],
      [299, 200],
    ],
  );
  for (const bad of ["trial", "constructor", "__proto__", "toString", null, 99])
    assert.equal(isPlan(bad), false);
});
test("trial boundary is exclusive and trial never follows paid expiry", () => {
  assert.equal(
    subscriptionAccess(trial, Date.parse("2026-11-18T23:59:59Z")).active,
    true,
  );
  assert.equal(
    subscriptionAccess(trial, Date.parse(trial.trial_ends_at)).active,
    false,
  );
  assert.equal(
    subscriptionAccess(
      { ...trial, expires_at: "2099-01-01" },
      Date.parse(trial.trial_ends_at),
    ).active,
    false,
  );
  assert.equal(
    subscriptionAccess(trial, Date.parse(trial.trial_started_at)).daysLeft,
    60,
  );
  assert.equal(subscriptionAccess(trial).limit, 30);
});
test("paid expiry overrides remaining trial; downgrade keeps lower capacity", () => {
  const sub = {
    ...trial,
    plan: "standard" as const,
    expires_at: "2026-09-21T00:00:00Z",
  };
  assert.equal(subscriptionAccess(sub, Date.parse("2026-09-22")).active, false);
  assert.equal(subscriptionAccess(sub).limit, 100);
  assert.equal(subscriptionAccess({ ...sub, plan: "starter" }).limit, 30);
  assert.equal(subscriptionAccess({ ...sub, plan: "pro" }).limit, 200);
  assert.equal(subscriptionAccess({ ...sub, expires_at: null }).active, false);
});
