"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveAuth } from "@/lib/auth";
import { AlertCircle, Loader2 } from "lucide-react";

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000"}/api/auth/login`, {
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

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">MWLAB</h1>
        <h2 className="mt-2 text-lg font-semibold text-gray-700">
          竞争盘面看板
        </h2>
        <p className="mt-1 text-sm text-gray-500">请使用内部账号登录</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-normal text-gray-700"
            >
              邮箱
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent"
              placeholder="user@mwlab.internal"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-normal text-gray-700"
            >
              密码
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

          {error && (
            <div
              className="flex items-center gap-1 text-sm text-red-600"
              role="alert"
            >
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-10 w-full items-center justify-center rounded-lg bg-accent font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "登录"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
