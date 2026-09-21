import { Suspense } from "react";
import SettingContent from "./setting-content";
import { getDict, getLocale } from "@/lib/i18n";

/** 服务端壳：字典与语言在这里读一次，往下传（角色校验由 proxy.ts 负责）。 */
export default async function SettingPage() {
  const [locale, t] = await Promise.all([getLocale(), getDict()]);
  return (
    <Suspense fallback={<SettingFallback />}>
      <SettingContent t={t} locale={locale} />
    </Suspense>
  );
}

function SettingFallback() {
  return (
    <div className="space-y-6 px-4 py-6 md:px-8 md:py-9">
      <div className="h-8 w-32 bg-surface border border-hairline rounded-lg animate-pulse" />
      <div className="h-[200px] bg-surface border border-hairline rounded-xl animate-pulse" />
      <div className="h-[300px] bg-surface border border-hairline rounded-xl animate-pulse" />
    </div>
  );
}
