import { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { intensityColor } from "../../lib/types";
import { useSessions, type SessionOccurrence } from "./useSessions";
import SessionDialog from "./SessionDialog";

export default function TrainingTab() {
  const { occurrences, loading, error, create, update, remove } = useSessions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SessionOccurrence | null>(null);
  const [createDate, setCreateDate] = useState<string | undefined>();
  const calRef = useRef<FullCalendar | null>(null);

  const events: EventInput[] = useMemo(
    () =>
      occurrences.map((o) => ({
        id: o.occurrenceId,
        title: `${o.title}${o.completed ? " ✓" : ""}`,
        start: o.start_time ? `${o.occurrenceDate}T${o.start_time}` : o.occurrenceDate,
        allDay: !o.start_time,
        backgroundColor: intensityColor[o.intensity],
        borderColor: intensityColor[o.intensity],
        textColor: "#fff",
        classNames: o.completed ? ["opacity-60"] : [],
        extendedProps: { occurrence: o },
      })),
    [occurrences],
  );

  function onDateClick(arg: DateClickArg) {
    setEditing(null);
    setCreateDate(arg.dateStr.slice(0, 10));
    setDialogOpen(true);
  }

  function onEventClick(arg: EventClickArg) {
    const occ = arg.event.extendedProps.occurrence as SessionOccurrence;
    setEditing(occ);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Training program</h2>
          <p className="text-xs text-slate-500">
            Click a day to add a session. Click an event to edit or mark complete.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-intensity-high" /> High
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-intensity-medium" /> Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-intensity-low" /> Low
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-xs p-3">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek",
          }}
          height="auto"
          events={events}
          dateClick={onDateClick}
          eventClick={onEventClick}
          firstDay={1}
        />
        {loading && (
          <div className="text-center text-xs text-slate-400 pt-2">Loading…</div>
        )}
      </div>

      <SessionDialog
        open={dialogOpen}
        existing={editing}
        initialDate={createDate}
        onClose={() => setDialogOpen(false)}
        onCreate={create}
        onUpdate={update}
        onDelete={remove}
      />
    </div>
  );
}
