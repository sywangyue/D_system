import { Suspense } from "react";
import CalendarContent from "./calendar-content";

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarFallback />}>
      <CalendarContent />
    </Suspense>
  );
}

function CalendarFallback() {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="h-[650px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />
            <div className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="flex-1 bg-gray-50 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
