import { Suspense } from "react";
import SettingContent from "./setting-content";

export default function SettingPage() {
  return (
    <Suspense fallback={<SettingFallback />}>
      <SettingContent />
    </Suspense>
  );
}

function SettingFallback() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 bg-surface border border-hairline rounded-lg animate-pulse" />
      <div className="h-[200px] bg-surface border border-hairline rounded-xl animate-pulse" />
      <div className="h-[300px] bg-surface border border-hairline rounded-xl animate-pulse" />
    </div>
  );
}
