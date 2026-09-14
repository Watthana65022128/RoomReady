"use client";

import { Suspense, createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone };
const flashMessages: Record<string, Toast["message"]> = {
  register: "สร้างบัญชีเรียบร้อย ยินดีต้อนรับสู่ RoomReady",
  login: "เข้าสู่ระบบเรียบร้อย",
  logout: "ออกจากระบบเรียบร้อย",
};
const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(ToastContext);

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.tone === "error" ? 8000 : 5000);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.tone, paused, dismiss]);
  return (
    <div className={`toast toast-${toast.tone}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <span className="toast-icon" aria-hidden="true">{toast.tone === "success" ? "✓" : toast.tone === "error" ? "!" : "i"}</span>
      <p role={toast.tone === "error" ? "alert" : "status"}>{toast.message}</p>
      <button type="button" className="toast-close" aria-label="ปิดการแจ้งเตือน" onClick={() => dismiss(toast.id)}>×</button>
    </div>
  );
}

function FlashToast() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const notify = useToast();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const flash = searchParams.get("toast");
    if (!flash) {
      handled.current = null;
      return;
    }
    const key = pathname + "?" + searchParams.toString();
    if (handled.current === key) return;
    handled.current = key;
    const message = flashMessages[flash];
    if (message) notify(message, "success");
    const next = new URLSearchParams(searchParams.toString());
    next.delete("toast");
    window.history.replaceState(
      window.history.state,
      "",
      pathname + (next.size ? "?" + next.toString() : "") + window.location.hash,
    );
  }, [pathname, searchParams, notify]);
  return null;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const viewport = useRef<HTMLDivElement>(null);
  const notify = useCallback((message: string, tone: Tone = "info") => {
    if (!message) return;
    const id = ++nextId.current;
    setToasts((items) => [...items.slice(-2), { id, message, tone }]);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  useEffect(() => {
    // Native popovers remain visible above modal dialogs without moving focus.
    if (toasts.length) viewport.current?.showPopover();
    else viewport.current?.hidePopover();
  }, [toasts]);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
      <div ref={viewport} popover="manual" className="toast-viewport" aria-label="การแจ้งเตือน">
        {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}
