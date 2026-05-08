"use client";

import { useCallback } from "react";
import { Calendar, momentLocalizer, type EventPropGetter } from "react-big-calendar";
import moment from "moment";
import "moment/locale/zh-cn";
import "react-big-calendar/lib/css/react-big-calendar.css";

moment.locale("zh-cn");
const localizer = momentLocalizer(moment);

export interface CalendarEvent {
  edition_id: string;
  name_cn: string;
  date_start: string;
  date_end: string | null;
  venue: string;
  city: string;
  exhibitors_count: number | null;
  competition_relation: string;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}

const eventStyle: Record<string, React.CSSProperties> = {
  "竞争对手": {
    backgroundColor: "#FEE2E2",
    borderLeft: "3px solid #EF4444",
    color: "#DC2626",
    borderRadius: "4px",
  },
  "潜在伙伴": {
    backgroundColor: "#fff3ec",
    borderLeft: "3px solid #fe5c00",
    color: "#e55300",
    borderRadius: "4px",
  },
  default: {
    backgroundColor: "#F3F4F6",
    borderLeft: "3px solid #9CA3AF",
    color: "#6B7280",
    borderRadius: "4px",
  },
};

export default function CalendarView({ events, onSelectEvent }: CalendarViewProps) {
  const eventPropGetter: EventPropGetter<CalendarEvent> = useCallback(
    (event) => ({
      style: eventStyle[event.competition_relation] || eventStyle.default,
    }),
    [],
  );

  const titleAccessor = useCallback((event: CalendarEvent) => event.name_cn, []);

  const formattedEvents = events.map((e) => ({
    ...e,
    title: e.name_cn,
    start: new Date(e.date_start + "T00:00:00"),
    end: e.date_end
      ? new Date(e.date_end + "T23:59:59")
      : new Date(e.date_start + "T23:59:59"),
  }));

  return (
    <div className="h-[650px]">
      <Calendar
        localizer={localizer}
        events={formattedEvents}
        startAccessor="start"
        endAccessor="end"
        titleAccessor={titleAccessor}
        eventPropGetter={eventPropGetter}
        onSelectEvent={onSelectEvent}
        defaultView="month"
        views={["month", "week"]}
        popup
        tooltipAccessor={null}
        messages={{
          month: "月",
          week: "周",
          today: "今天",
          previous: "上一页",
          next: "下一页",
        }}
      />
    </div>
  );
}
