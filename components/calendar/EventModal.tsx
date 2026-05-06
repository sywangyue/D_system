"use client";

import { X } from "lucide-react";

interface CalendarEvent {
  edition_id: string;
  name_cn: string;
  venue: string;
  city: string;
  exhibitors_count: number | null;
}

interface EventModalProps {
  event: CalendarEvent | null;
  onClose: () => void;
}

export default function EventModal({ event, onClose }: EventModalProps) {
  if (!event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="展会详情"
    >
      <div
        className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl animate-[fadeIn_150ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-base font-semibold text-text-primary pr-4">
            {event.name_cn}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="场馆" value={event.venue || "—"} />
          <Field label="城市" value={event.city || "—"} />
          <Field
            label="展商数量"
            value={
              event.exhibitors_count != null
                ? event.exhibitors_count.toLocaleString("en-US")
                : "—"
            }
          />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-secondary w-16 flex-shrink-0">
        {label}
      </span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}
