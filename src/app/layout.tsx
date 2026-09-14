import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-kanit",
});

export const metadata: Metadata = {
  title: "RoomReady · จัดการหอพัก",
  description: "มิเตอร์ บิล และยอดรับชำระ จัดการครบในที่เดียว",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={kanit.variable}>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
