import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "หอพร้อม · จัดการหอพัก",
  description: "มิเตอร์ บิล และยอดรับชำระ จัดการครบในที่เดียว",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
