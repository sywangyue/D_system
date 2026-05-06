import { Suspense } from "react";
import MapContent from "./map-content";

export default function MapPage() {
  return (
    <Suspense fallback={<MapFallback />}>
      <MapContent />
    </Suspense>
  );
}

function MapFallback() {
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="h-[500px] bg-gray-100 animate-pulse rounded-lg" />
    </div>
  );
}
