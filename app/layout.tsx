import type { Metadata } from "next";
import localFont from "next/font/local";
import AppShell from "@/components/layout/AppShell";
import "./globals.css";

const montserrat = localFont({
  src: "../public/fonts/montserrat-latin.woff2",
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MWLAB 2026 | 竞争盘面看板",
  description: "Exhibition Competitive Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={montserrat.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
