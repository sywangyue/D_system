import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["172.16.3.146"],
  env: {
    // 构建时间在这里**一次性**写死，供 /api/setting/status 显示。
    // 之前接口里写的是 `process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()`，
    // 而仓库里没有任何地方设这个变量 —— 于是「构建时间」显示的是每次请求的当前时间，
    // 看着像构建时间，其实每次刷新都在变（TASK-I §3.1）。
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
