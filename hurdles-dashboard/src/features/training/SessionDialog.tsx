import { useEffect, useState } from "react";
import {
  INTENSITIES,
  SESSION_TYPES,
  type Intensity,
  type SessionInput,
} from "../../lib/types";
import { SESSION_ICONS } from "../../lib/sessionIcons";
import type { SessionOccurrence } from "./useSessions";

interface Props {
  open: boolean;
  initialDate?: string;            // YYYY-MM-DD when creating
  existing?: SessionOccurrence | null;
  onClose: () => void;
  onCreate: (input: SessionInput) => Promise<void>;
  onUpdate: (id: string, patch: Partial<SessionInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function emptyInput(date: string): SessionInput {
  return {
    date,
    start_time: null,
    session_type: "Hurdles",
    intensity: "High",
    title: "",
    planned_notes: null,
    actual_notes: null,
    completed: false,
    recurrence: null,
    recurrence_until: null,
  };
}

export default function SessionDialog({
  open,
  initialDate,
  existing,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const editing = Boolean(existing);
  const [form, setForm] = useState<SessionInput>(
    emptyInput(initialDate ?? new Date().toISOString().slice(0, 10)),
  );
  const [showComplete, setShowComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setShowComplete(false);
    if (existing) {
      setForm({
        date: existing.date,
        start_time: existing.start_time,
        session_type: existing.session_type,
        intensity: existing.intensity,
        title: existing.title,
        planned_notes: existing.planned_notes,
        actual_notes: existing.actual_notes,
        completed: existing.completed,
        recurrence: existing.recurrence,
        recurrence_until: existing.recurrence_until,
      });
    } else {
      setForm(emptyInput(initialDate ?? new Date().toISOString().slice(0, 10)));
    }
  }, [open, existing, initialDate]);

  if (!open) return null;

  function set<K extends keyof SessionInput>(key: K, value: SessionInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      if (existing) {
        await onUpdate(existing.id, form);
      } else {
        await onCreate(form);
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function markComplete() {
    if (!existing) return;
    setBusy(true);
    setErr(null);
    try {
      await onUpdate(existing.id, {
        completed: true,
        actual_notes: form.actual_notes,
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    if (!existing) return;
    if (!confirm("Delete this session? Recurring series will also be removed.")) return;
    setBusy(true);
    try {
      await onDelete(existing.id);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold">
            {editing ? "Edit session" : "New session"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-3">
          {editing && !existing!.completed && !showComplete && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowComplete(true)}
                className="flex-1 rounded-md bg-emerald-600 text-white py-2 text-sm font-medium hover:bg-emerald-700"
              >
                Mark complete
              </button>
              <button
                onClick={() => setShowComplete(false)}
                className="flex-1 rounded-md bg-slate-100 text-slate-800 py-2 text-sm font-medium hover:bg-slate-200"
              >
                Edit session
              </button>
            </div>
          )}

          {showComplete ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Actual session notes (what happened?)
              </label>
              <textarea
                rows={5}
                value={form.actual_notes ?? ""}
                onChange={(e) => set("actual_notes", e.target.value || null)}
                placeholder="Splits, RPE, drills, anything worth remembering…"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={form.start_time ?? ""}
                    onChange={(e) => set("start_time", e.target.value || null)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. 6 x 200m @ 28s"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Session type
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SESSION_TYPES.map((t) => {
                      const Icon = SESSION_ICONS[t];
                      const selected = form.session_type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => set("session_type", t)}
                          className={`flex flex-col items-center gap-1 rounded-md border py-2 px-1 text-[11px] font-medium transition-colors ${
                            selected
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          <Icon size={14} />
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Intensity
                  </label>
                  <select
                    value={form.intensity}
                    onChange={(e) => set("intensity", e.target.value as Intensity)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    {INTENSITIES.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Planned notes
                </label>
                <textarea
                  rows={3}
                  value={form.planned_notes ?? ""}
                  onChange={(e) => set("planned_notes", e.target.value || null)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Recurrence
                  </label>
                  <select
                    value={form.recurrence ?? ""}
                    onChange={(e) =>
                      set(
                        "recurrence",
                        e.target.value === "weekly" ? "weekly" : null,
                      )
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">None</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Repeat until
                  </label>
                  <input
                    type="date"
                    disabled={form.recurrence !== "weekly"}
                    value={form.recurrence_until ?? ""}
                    onChange={(e) => set("recurrence_until", e.target.value || null)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </div>
              </div>

              {editing && existing!.completed && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Actual session notes
                  </label>
                  <textarea
                    rows={3}
                    value={form.actual_notes ?? ""}
                    onChange={(e) => set("actual_notes", e.target.value || null)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
            </>
          )}

          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <div>
            {editing && (
              <button
                onClick={destroy}
                disabled={busy}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-md bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200"
            >
              Cancel
            </button>
            {showComplete ? (
              <button
                onClick={markComplete}
                disabled={busy}
                className="rounded-md bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
              >
                Save as complete
              </button>
            ) : (
              <button
                onClick={save}
                disabled={busy || !form.title.trim()}
                className="rounded-md bg-slate-900 text-white px-3 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
