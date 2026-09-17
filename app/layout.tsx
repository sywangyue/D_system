import type { Metadata } from "next";
import localFont from "next/font/local";
import AppShell from "@/components/layout/AppShell";
import "./globals.css";
import "../design/motion.css";

/**
 * 拉丁两款自托管，不走 fonts.googleapis.com ——
 * 用户在中国大陆、服务器在阿里云，线上渲染不能赌 Google 可达。
 * 中文不加载 webfont，走系统栈（见 globals.css 的 --font-cjk）。
 */
const geist = localFont({
  src: "../public/fonts/geist-latin.woff2",
  variable: "--font-geist",
  weight: "400 700",          // 可变字体，一个文件覆盖全字重
  display: "swap",
});

const jetbrains = localFont({
  src: "../public/fonts/jetbrains-mono-latin.woff2",
  variable: "--font-jetbrains",
  weight: "400 500",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MWLAB 万象 · 竞争盘面看板",
  description: "Messe Düsseldorf Shanghai · Business Development",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: "/favicon-192.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${geist.variable} ${jetbrains.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
