"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUserInfo } from "@/lib/auth";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const userInfo = getUserInfo();

  const [allL1s, setAllL1s] = useState<string[]>([]);
  const [selectedL1s, setSelectedL1s] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!userInfo) {
      router.push("/login");
      return;
    }
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/user/preferences").then((r) => r.json()),
    ]).then(([dashData, prefs]) => {
      const l1s: string[] = Array.from(
        new Set<string>(
          (dashData.brands ?? [])
            .map((b: { industry_l1?: string }) => b.industry_l1)
            .filter(Boolean) as string[]
        )
      ).sort();
      setAllL1s(l1s);
      if (Array.isArray(prefs.l1s) && prefs.l1s.length > 0) {
        setSelectedL1s(new Set(prefs.l1s));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleL1(l1: string) {
    setSelectedL1s((prev) => {
      const next = new Set(prev);
      if (next.has(l1)) next.delete(l1);
      else next.add(l1);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ l1s: Array.from(selectedL1s) }),
      });
      setSaved(true);
      setTimeout(() => router.push("/dashboard.html"), 1500);
    } finally {
      setSaving(false);
    }
  }

  const initials = userInfo
    ? (userInfo.display_name || userInfo.email || "").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Back */}
        <button
          onClick={() => router.push("/dashboard.html")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={16} />
          返回 Dashboard
        </button>

        {/* User card */}
        <div className="bg-white rounded-xl border border-border p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-bold text-lg">
              {initials}
            </div>
            <div>
              <div className="font-semibold text-gray-900">
                {userInfo?.display_name || "用户"}
              </div>
              <div className="text-sm text-gray-500">{userInfo?.email}</div>
              <div className="text-xs text-gray-400 mt-0.5 capitalize">
                {userInfo?.role}
              </div>
            </div>
          </div>
        </div>

        {/* Industry preference */}
        <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            定制 Dashboard 行业筛选
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            勾选后，下次登录 Dashboard 将自动应用所选行业筛选。不勾选则显示全部。
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
              <Loader2 size={16} className="animate-spin" />
              加载中…
            </div>
          ) : (
            <div className="space-y-2">
              {allL1s.map((l1) => (
                <label
                  key={l1}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer select-none"
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selectedL1s.has(l1)
                        ? "bg-accent border-accent"
                        : "border-gray-300 bg-white"
                    }`}
                    onClick={() => toggleL1(l1)}
                  >
                    {selectedL1s.has(l1) && (
                      <Check size={12} className="text-white" strokeWidth={3} />
                    )}
                  </div>
                  <span
                    className="text-sm text-gray-800"
                    onClick={() => toggleL1(l1)}
                  >
                    {l1}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="flex items-center gap-2 h-10 px-6 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saved ? (
                <><Check size={14} /> 已保存，正在跳转…</>
              ) : (
                "保存偏好"
              )}
            </button>
            {selectedL1s.size > 0 && (
              <span className="text-sm text-gray-400">
                已选 {selectedL1s.size} 个行业
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
