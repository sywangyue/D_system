"use client";

import { useState } from "react";
import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import { errorText, fill, type Dict } from "@/lib/i18n-shared";
import { INDUSTRY_L1, enumLabel } from "@/lib/enums";
import { ArrowLeft, Check } from "lucide-react";

/**
 * 个人资料。
 *
 * 首屏**零个接口请求**：偏好在服务端壳里读好传进来（TASK-I §2.2）。
 * 之前这里为了拿 8 个行业名去请求旧看板那个端点 —— 它一次吐回全部 7,401 个品牌，
 * 只为在前端 Set 去重出 8 个值；那个端点已随本任务删除。
 */
export default function ProfileContent({
  userInfo,
  t,
  initialL1s,
}: {
  userInfo: SessionUser;
  t: Dict;
  initialL1s: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialL1s));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const industryMap = t.enum.industryL1 as Record<string, string>;

  function toggle(value: string) {
    setSaved(false);
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // 提交的是**中文原值**（INDUSTRY_L1 的 value），不是 slug（TASK-I §5.1）
        body: JSON.stringify({ l1s: [...selected] }),
      });
      // 之前这里不检查 res.ok，接口 400 / 401 也照样显示「已保存」（TASK-I §2.3）
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(errorText(t, body.error, body.values, t.profile.saveFailed));
      }
      // 保存成功**不跳转**：原地显示「已保存」。
      // 自动跳走是给旧看板设计的（保存完回去看效果），现在偏好作用在展会底图，
      // 由用户自己决定去不去看 —— 页面上给个链接（TASK-I §2.1）。
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.profile.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const initials = (userInfo.display_name || userInfo.email)
    .slice(0, 1)
    .toUpperCase();

  return (
    <div className="max-w-lg mx-auto py-12 px-6">
      {/* 返回盘面。原来指向旧看板的静态页 —— 那个文件阶段 5 就删了，
          点一下（以及保存后 1.5 秒）会跳到 404（TASK-I §2.1） */}
      <Link
        href="/overview"
        className="flex items-center gap-2 text-[13px] text-fg-subtle hover:text-fg mb-7"
      >
        <ArrowLeft size={14} />
        {t.profile.back}
      </Link>

      <div className="border border-hairline rounded-lg p-6 bg-surface">
        <div className="flex items-center gap-4 mb-7">
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-[var(--color-accent-fg)] font-medium">
            {initials}
          </div>
          <div>
            <div className="text-[15px] text-fg">{userInfo.display_name || t.profile.user}</div>
            <div className="text-[12px] text-fg-subtle">{userInfo.email}</div>
          </div>
        </div>

        <div className="mb-2">
          <h2 className="text-[14px] text-fg">{t.profile.industryFilter}</h2>
          <p className="text-[12px] text-fg-subtle mt-1 mb-4 leading-relaxed">
            {t.profile.industryFilterHint}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6">
          {/* 顺序就用 INDUSTRY_L1 的数组顺序（按品牌数从多到少），不排序 ——
              对中文原值 .sort() 在两种语言下都没有意义（TASK-I §2.2） */}
          {INDUSTRY_L1.map(({ value }) => (
            <label
              key={value}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-elevated cursor-pointer select-none"
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  selected.has(value)
                    ? "bg-accent border-accent"
                    : "border-hairline-active bg-surface"
                }`}
                onClick={() => toggle(value)}
              >
                {selected.has(value) && (
                  <Check size={12} className="text-[var(--color-accent-fg)]" strokeWidth={3} />
                )}
              </div>
              <span className="text-sm text-fg" onClick={() => toggle(value)}>
                {enumLabel(INDUSTRY_L1, industryMap, value)}
              </span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-[12px] text-fg-subtle">
            {fill(t.profile.selected, { n: selected.size })}
            {saved && <span className="ml-3 text-fg">{t.profile.saving}</span>}
            {saved && (
              <Link href="/expo" className="ml-3 underline underline-offset-2 hover:text-fg">
                {t.profile.viewBasemap}
              </Link>
            )}
            {error && <span className="ml-3 text-[var(--color-error-text)]">{error}</span>}
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-[6px] bg-accent text-[var(--color-accent-fg)] text-[13px] hover:bg-accent-hover disabled:opacity-40"
          >
            {t.profile.savePrefs}
          </button>
        </div>
      </div>
    </div>
  );
}
