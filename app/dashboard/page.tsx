import { Suspense } from "react";
import DashboardContent from "./dashboard-content";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardFallback() {
  return (
    <div className="space-y-6">
      <div className="h-[120px] bg-white border border-border rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 bg-white border border-border rounded-xl animate-pulse"
          />
        ))}
      </div>
      <div className="h-[350px] bg-white border border-border rounded-xl animate-pulse" />
    </div>
  );
}
