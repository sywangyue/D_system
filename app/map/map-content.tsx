"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import Legend from "@/components/map/Legend";
import EmptyState from "@/components/ui/EmptyState";
import type { CityMarker } from "./map-view";

const MapView = dynamic(() => import("./map-view"), { ssr: false });

export default function MapContent() {
  const [markers, setMarkers] = useState<CityMarker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMarkers() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/map/markers");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "无法加载地图数据");
        }
        const json = await res.json();
        setMarkers(json.markers || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "网络异常，请稍后重试");
      } finally {
        setIsLoading(false);
      }
    }
    fetchMarkers();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white border border-border rounded-xl p-4">
        <div className="h-[500px] bg-gray-100 animate-pulse rounded-lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white border border-border rounded-xl p-4">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-sm text-destructive mb-3">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-dark transition-colors"
          >
            点击重试
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (markers.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-4">
        <EmptyState icon={<MapPin size={48} className="text-gray-300" />} message="暂无展会地理数据" />
      </div>
    );
  }

  // Populated state
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="relative" style={{ height: 500 }}>
        <MapView markers={markers} />
        <Legend />
      </div>
    </div>
  );
}
