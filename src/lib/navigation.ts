export type DashboardLocation = {
  tab: "overview" | "billing" | "rooms" | "settings";
  month: string;
  step: "meters" | "bills" | "share";
  status: string;
  query: string;
};

export function dashboardHref(location: DashboardLocation) {
  const params = new URLSearchParams();
  params.set("tab", location.tab);
  params.set("month", location.month);
  if (location.tab === "billing") {
    params.set("step", location.step);
    if (location.step === "share" && location.status !== "all") {
      params.set("status", location.status);
    }
    if (location.query) params.set("q", location.query);
  }
  return `/dashboard?${params.toString()}`;
}

export function withReturnTo(path: string, returnTo: string) {
  return `${path}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function safeReturnTo(value: string | undefined, allowInvoice = false) {
  if (typeof value !== "string" || !value || value.length > 2048 || value.includes("\\") || value.includes("#")) return null;
  const path = value.split("?", 1)[0];
  if (path === "/dashboard") return value;
  if (allowInvoice && /^\/invoices\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(path)) {
    return value;
  }
  return null;
}
