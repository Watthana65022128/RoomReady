"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { subscriptionAccess, type Subscription } from "@/lib/plans";
const Access = createContext(false);
export function OwnerAccess({
  subscription,
  children,
}: {
  subscription: Subscription;
  children: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Access.Provider value={subscriptionAccess(subscription, now).active}>
      {children}
    </Access.Provider>
  );
}
export function useOwnerAccess() {
  return useContext(Access);
}
