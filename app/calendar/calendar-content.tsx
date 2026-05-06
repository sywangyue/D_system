"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import EventModal from "@/components/calendar/EventModal";
import type { CalendarEvent } from "./calendar-view";

const CalendarView = dynamic(() => import("./calendar-view"), { ssr: false });

export default function CalendarContent() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/calendar/events");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "无法加载展会日程");
        }
        const json = await res.json();
        setEvents(json.events || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "网络异常，请稍后重试");
      } finally {
        setIsLoading(false);
      }
    }
    fetchEvents();
  }, []);

  // Loading state
  if (isLoading) {
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
  if (events.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-4">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-sm text-text-secondary">当前视图内无展会安排</div>
        </div>
      </div>
    );
  }

  // Populated state
  return (
    <>
      <div className="bg-white border border-border rounded-xl p-4">
        <CalendarView
          events={events}
          onSelectEvent={setSelectedEvent}
        />
      </div>
      <EventModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
}
