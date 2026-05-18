"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveAuth } from "@/lib/auth";
import { AlertCircle, Loader2, Mail } from "lucide-react";

const CONTACT_EMAIL = "wangyue8811@gmail.com";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("请输入邮箱地址");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("邮箱格式不正确");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setError("邮箱或密码错误，请重试");
        } else {
          setError(body.detail || "网络异常，请稍后重试");
        }
        setLoading(false);
        return;
      }

      const data = await res.json();
      saveAuth(
        { email: data.email, role: data.role, display_name: data.display_name },
        data.token,
      );

      document.cookie = `session=${data.token}; path=/; max-age=86400; SameSite=Lax`;

      router.push("/dashboard.html");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
      setLoading(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center"
      style={{
        backgroundImage: "url('/login-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* 遮罩层：图片不存在时显示深色渐变 */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/60 to-gray-800/60" />

      {/* 登录卡片 (A) */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="rounded-2xl border border-white/20 bg-white/90 p-8 shadow-2xl backdrop-blur-sm">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            MWLAB 2026
          </h1>
          <h2 className="mt-1 text-base font-medium text-gray-600">
            展会竞争盘面看板
          </h2>
          <p className="mt-1 text-xs text-gray-400">请使用内部账号登录</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                邮箱
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="user@mwlab.internal"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                密码
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {error && (
              <div
                className="flex items-center gap-1.5 text-sm text-red-600"
                role="alert"
              >
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center rounded-lg bg-accent font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "登录"
              )}
            </button>
          </form>
        </div>

        {/* 联系我 (B) */}
        <div className="mt-4 flex justify-center">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-white/80 transition-colors hover:text-white"
          >
            <Mail size={14} />
            <span>联系我</span>
          </a>
        </div>
      </div>
    </div>
  );
}
