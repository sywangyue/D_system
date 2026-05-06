"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface CityMarker {
  city: string;
  count: number;
  lat: number;
  lng: number;
  top_exhibitions: string[];
  is_china: boolean;
}

interface MapViewProps {
  markers: CityMarker[];
}

function getRadius(count: number): number {
  return 6 + Math.min(count * 1.5, 20);
}

function chinaStyle(count: number) {
  return {
    radius: getRadius(count),
    fillColor: "#3B82F6",
    fillOpacity: 0.65,
    color: "#2563EB",
    weight: 2,
  };
}

function intlStyle(count: number) {
  return {
    radius: getRadius(count),
    fillColor: "#F97316",
    fillOpacity: 0.65,
    color: "#EA580C",
    weight: 2,
  };
}

export default function MapView({ markers }: MapViewProps) {
  const visible = markers.filter((m) => m.lat !== undefined && m.lng !== undefined);

  return (
    <MapContainer
      center={[35, 105]}
      zoom={4}
      style={{ height: "500px", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {visible.map((m, i) => (
        <CircleMarker
          key={`${m.city}-${i}`}
          center={[m.lat, m.lng]}
          pathOptions={m.is_china ? chinaStyle(m.count) : intlStyle(m.count)}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold text-gray-900 mb-1">{m.city}</div>
              <div className="text-xs text-gray-600 mb-2">
                {m.count} 个展会
                <span className="ml-2 inline-block w-2 h-2 rounded-full" style={{
                  backgroundColor: m.is_china ? "#3B82F6" : "#F97316",
                }} />
                <span className="ml-1 text-gray-500">
                  {m.is_china ? "国内" : "国际"}
                </span>
              </div>
              {m.top_exhibitions.length > 0 && (
                <div className="text-xs text-gray-500">
                  {m.top_exhibitions.join("、")}
                </div>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
