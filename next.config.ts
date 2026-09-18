import type { NextConfig } from "next";

/**
 * 安全响应头（2026-09-18 新增）。
 *
 * 加这组之前线上一个安全头都没有，而且 `strict-transport-security: max-age=0`
 * —— HSTS 被显式关掉了，等于允许浏览器把请求降级成 HTTP。
 *
 * ⚠️ **HSTS 这条可能被 Cloudflare 覆盖**：那个 max-age=0 不是 Next 发的（Next 默认
 * 不发这个头），是边缘发的。要让它真正生效，得去 Cloudflare 控制台
 * SSL/TLS → Edge Certificates → HSTS 打开。这里设了是为了源站直连时也有保护。
 *
 * CSP 用的是 report-only：这个站有内联样式（令牌变量、SVG 的 style 属性）与内联脚本
 * （Next 的水合引导），直接上强制模式会白屏。先观察上报，确认无误再收紧。
 */
const securityHeaders = [
  // 一年 + 子域 + 允许进入预加载列表
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // 禁止被嵌进别人的 iframe（点击劫持）
  { key: "X-Frame-Options", value: "DENY" },
  // 禁止浏览器猜 MIME 类型
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 跨站跳转时不带完整 URL
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 这个系统不需要这些设备权限
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // 跨域隔离，防止被别的源读取窗口
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["172.16.3.146"],
  env: {
    // 构建时间在这里**一次性**写死，供 /api/setting/status 显示。
    // 之前接口里写的是 `process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()`，
    // 而仓库里没有任何地方设这个变量 —— 于是「构建时间」显示的是每次请求的当前时间，
    // 看着像构建时间，其实每次刷新都在变（V2-13 §3.1）。
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
