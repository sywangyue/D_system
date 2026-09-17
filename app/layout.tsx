import type { Metadata } from "next";
import localFont from "next/font/local";
import AppShell from "@/components/layout/AppShell";
import { getSessionUser } from "@/lib/session";
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

/**
 * 品牌锁定里的「万象」两个字。子集只有万(U+4E07)、象(U+8C61)两字，1.3KB。
 * 与兄弟品牌问津的「问津」同款：Noto Serif SC 700 —— 同一套体系里，
 * 两个品牌的中文字标必须是一款字，这是它们唯一的视觉联结。
 * 正文不加载任何 CJK webfont，仍走系统栈（见 globals.css 的 --font-cjk）。
 */
const notoSerifScLogo = localFont({
  src: "../public/fonts/noto-serif-sc-logo.woff2",
  variable: "--font-logo-serif",
  weight: "700",
  display: "block",   // 两个字，等它加载完再画，免得先闪一下回退的宋体
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 登录态在这里读一次，往下传。全站唯一的读取点。
  const user = await getSessionUser();

  return (
    <html lang="zh-CN" className={`${geist.variable} ${jetbrains.variable} ${notoSerifScLogo.variable}`}>
      <body>
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
