export const PLANS = {
  starter: { name: "Starter", price: 199, rooms: 50 },
  standard: { name: "Standard", price: 299, rooms: 100 },
  pro: { name: "Pro", price: 399, rooms: 200 },
} as const;
export type Plan = keyof typeof PLANS;
export const TRIAL_DAYS = 60;
export const TRIAL_ROOMS = PLANS.starter.rooms;
export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && Object.hasOwn(PLANS, value);
}
export type Subscription = {
  owner_id: string;
  plan: Plan | "trial";
  trial_started_at: string;
  trial_ends_at: string;
  expires_at: string | null;
};
export function subscriptionAccess(
  subscription: Subscription,
  now = Date.now(),
) {
  const trial = subscription.plan === "trial";
  const end = trial ? subscription.trial_ends_at : subscription.expires_at;
  const active = !!end && new Date(end).getTime() > now;
  const limit = trial ? TRIAL_ROOMS : PLANS[subscription.plan as Plan].rooms;
  return {
    active,
    limit,
    end,
    trial,
    daysLeft: end
      ? Math.max(0, Math.ceil((new Date(end).getTime() - now) / 86400000))
      : 0,
  };
}
