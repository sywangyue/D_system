import { headers } from "next/headers";
import type { Metadata } from "next";
import localFont from "next/font/local";
import AppShell from "@/components/layout/AppShell";
import { getSessionUser } from "@/lib/session";
import { getLocale, getDict } from "@/lib/i18n";
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
 *
 * ⚠️ 英文版（locale=en）**不挂这个变量类**：那就等于整站没有引用任何 CJK 字体，
 * 浏览器一个中文字体都不会下载（I18N-SPEC §1 第二层）。字体栈的摘除在
 * globals.css 的 html[lang="en"] 规则里（第一层），两层都要。
 */
const notoSerifScLogo = localFont({
  src: "../public/fonts/noto-serif-sc-logo.woff2",
  variable: "--font-logo-serif",
  weight: "700",
  display: "block",   // 两个字，等它加载完再画，免得先闪一下回退的宋体
  // ⚠️ 必须关掉 preload：不关的话 next/font 会在 <head> 里发一条
  // <link rel="preload" as="font">，**英文版也会照下**这个 CJK 子集 ——
  // 那就等于第二层没做（实测 lang=en 时网络里仍出现 noto_serif_sc_logo.woff2）。
  // 关掉之后：中文版靠 CSS 变量引用触发按需加载（display:block 兜住闪烁），
  // 英文版既没有这个变量类、也没有 preload，一个字节都不会下。
  preload: false,
});

/** 标题按语言取 —— 静态 metadata 写死会在英文版里漏中文。 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getDict();
  return {
    title: t.meta.title,
    description: "Messe Düsseldorf Shanghai · Business Development",
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", type: "image/x-icon" },
      ],
      apple: "/favicon-192.png",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 登录态与语言都在这里各读一次，往下传。全站唯一的读取点。
  const [user, locale, t, h] = await Promise.all([
    getSessionUser(), getLocale(), getDict(), headers(),
  ]);
  // 落地页（/）由中间件打上 x-mwlab-bare：登录与否都不套后台外壳
  const bare = h.get("x-mwlab-bare") === "1";

  const fontVars = [
    geist.variable,
    jetbrains.variable,
    locale === "zh" ? notoSerifScLogo.variable : "",
  ].filter(Boolean).join(" ");

  return (
    <html lang={locale === "en" ? "en" : "zh-CN"} className={fontVars}>
      <body>
        <AppShell user={bare ? null : user} locale={locale} t={t}>{children}</AppShell>
      </body>
    </html>
  );
}
