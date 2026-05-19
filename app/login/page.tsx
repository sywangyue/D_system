"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveAuth } from "@/lib/auth";
import { AlertCircle, Loader2, Mail } from "lucide-react";

const CONTACT_EMAIL = "wangyue8811@gmail.com";
const CHARS = "ｦｧｨｩｪｫｬｭｮｯｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789";
const TW_TEXT = "The Matrix has you";

function TypewriterLine() {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (displayed.length >= TW_TEXT.length) {
      const t = setTimeout(() => setDisplayed(""), 2000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setDisplayed(TW_TEXT.slice(0, displayed.length + 1)),
      80,
    );
    return () => clearTimeout(t);
  }, [displayed]);

  return (
    <>
      <style>{`@keyframes tw-blink{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
      <div style={{ color: "#FE5C00", fontSize: "17px", fontWeight: 700, letterSpacing: "0.07em", marginBottom: "28px" }}>
        {displayed}
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "2px",
            height: "13px",
            background: "#FE5C00",
            marginLeft: "3px",
            verticalAlign: "middle",
            animation: "tw-blink 1s step-end infinite",
          }}
        />
      </div>
    </>
  );
}

function MatrixCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const SZ = 14;

    const resize = () => {
      cvs.width = cvs.offsetWidth;
      cvs.height = cvs.offsetHeight;
    };

    const initDrops = () =>
      Array.from(
        { length: Math.max(1, Math.floor(cvs.width / SZ)) },
        () => Math.floor(Math.random() * (cvs.height / SZ)),
      );

    let drops: number[] = [];

    const tick = () => {
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      ctx.font = `${SZ}px 'Courier New', monospace`;
      drops.forEach((y, i) => {
        ctx.fillStyle = "rgba(254,92,0,0.75)";
        ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * SZ, y * SZ);
        ctx.fillStyle = "#FFC87A";
        ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * SZ, y * SZ);
        if (y * SZ > cvs.height && Math.random() > 0.96) drops[i] = 0;
        drops[i]++;
      });
    };

    const ro = new ResizeObserver(() => {
      resize();
      drops = initDrops();
    });
    ro.observe(cvs);

    const id = setInterval(tick, 40);
    return () => {
      clearInterval(id);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim()) { setError("请输入邮箱地址"); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError("邮箱格式不正确"); return; }
    if (!password) { setError("请输入密码"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          res.status === 401 ? "邮箱或密码错误，请重试" : body.detail || "网络异常，请稍后重试"
        );
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
    <div className="flex min-h-screen">
      {/* ── Left panel: pure black + matrix rain ── */}
      <div className="relative hidden lg:flex lg:w-[61.8%] flex-col overflow-hidden select-none" style={{ background: "#000" }}>
        <MatrixCanvas />
        {/* Branding */}
        <div className="relative z-10 flex flex-col h-full justify-end p-14 pb-16">
          <div className="text-white/50 text-[10px] tracking-[0.35em] uppercase font-semibold mb-5">
            MWLAB · 2026
          </div>
          <h1
            className="text-white font-bold tracking-tight leading-[1.05]"
            style={{ fontSize: "52px" }}
          >
            展会竞争
            <br />
            盘面看板
          </h1>
          <p className="text-white/50 text-sm mt-5 font-normal tracking-wide">
            Exhibition Competitive Intelligence Dashboard
          </p>
        </div>
      </div>

      {/* ── Right panel: Login form ── */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-white px-8 pt-8 lg:px-14">
        <div className="w-full max-w-[340px]">
          {/* Mobile-only logo */}
          <div className="lg:hidden mb-10 text-center">
            <div className="text-2xl font-bold text-gray-900">MWLAB 2026</div>
            <div className="text-sm text-gray-400 mt-1">展会竞争盘面看板</div>
          </div>

          <TypewriterLine />

          <div className="mb-6">
            <h2
              className="font-bold text-gray-900 tracking-tight leading-none"
              style={{ fontSize: "26px" }}
            >
              欢迎回来
            </h2>
            <p className="text-sm text-gray-400 mt-2">请使用内部账号登录</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-[10px] font-bold text-gray-400 tracking-[0.12em] uppercase mb-2.5"
              >
                邮箱
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-200 px-4 text-sm text-gray-900 placeholder:text-gray-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                placeholder="user@mwlab.internal"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[10px] font-bold text-gray-400 tracking-[0.12em] uppercase mb-2"
              >
                密码
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-200 px-4 text-sm text-gray-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm rounded-lg px-3.5 py-2.5" style={{ color: "#FE5C00", background: "rgba(254,92,0,0.06)" }}>
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-accent font-bold text-white text-sm tracking-[0.12em] uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "登 录"}
            </button>
          </form>
        </div>

        {/* Contact link */}
        <div className="absolute bottom-8">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Mail size={13} />
            <span>联系我</span>
          </a>
        </div>
      </div>
    </div>
  );
}
