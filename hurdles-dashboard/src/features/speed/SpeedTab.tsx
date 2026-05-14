import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { useSplits } from "./useSplits";

const DISTANCES = [10, 20, 30] as const;
type Distance = (typeof DISTANCES)[number];

type Metric = "time" | "ms" | "kph" | "mph";

const METRIC_OPTIONS: { value: Metric; label: string; unit: string; decimals: number }[] = [
  { value: "time", label: "Split time", unit: "s",   decimals: 2 },
  { value: "ms",   label: "m/s",        unit: "m/s", decimals: 2 },
  { value: "kph",  label: "kph",        unit: "kph", decimals: 2 },
  { value: "mph",  label: "mph",        unit: "mph", decimals: 2 },
];

const MS_TO_KPH = 3.6;
const MS_TO_MPH = 2.2369362921;

function toMs(distance: number, time: number) {
  return time > 0 ? distance / time : 0;
}

function convert(distance: number, time: number, metric: Metric) {
  if (metric === "time") return time;
  const ms = toMs(distance, time);
  if (metric === "ms") return ms;
  if (metric === "kph") return ms * MS_TO_KPH;
  return ms * MS_TO_MPH;
}

interface ChartPoint {
  date: string;
  best_time: number;
  avg_time: number;
  best_ms: number;
  avg_ms: number;
  best_kph: number;
  avg_kph: number;
  best_mph: number;
  avg_mph: number;
  best: number;     // value plotted for chart (depends on metric)
  avg: number;
  notes: string | null;
}

export default function SpeedTab() {
  const { splits, loading, error, create, remove } = useSplits();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [distance, setDistance] = useState<Distance>(10);
  const [best, setBest] = useState("");
  const [avg, setAvg] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<Distance>(10);
  const [metric, setMetric] = useState<Metric>("time");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const metricMeta = METRIC_OPTIONS.find((m) => m.value === metric)!;

  const filtered = useMemo(
    () => splits.filter((s) => s.distance === filter),
    [splits, filter],
  );

  const chartData: ChartPoint[] = useMemo(
    () =>
      filtered.map((s) => {
        const bt = Number(s.best_time);
        const at = Number(s.avg_time);
        const bms = toMs(s.distance, bt);
        const ams = toMs(s.distance, at);
        return {
          date: s.date,
          best_time: bt,
          avg_time: at,
          best_ms: bms,
          avg_ms: ams,
          best_kph: bms * MS_TO_KPH,
          avg_kph: ams * MS_TO_KPH,
          best_mph: bms * MS_TO_MPH,
          avg_mph: ams * MS_TO_MPH,
          best: convert(s.distance, bt, metric),
          avg: convert(s.distance, at, metric),
          notes: s.notes,
        };
      }),
    [filtered, metric],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    const bestN = parseFloat(best);
    const avgN = parseFloat(avg);
    if (!Number.isFinite(bestN) || !Number.isFinite(avgN)) {
      setFormErr("Best and average must be numbers (seconds).");
      return;
    }
    setBusy(true);
    try {
      await create({
        date,
        distance,
        best_time: bestN,
        avg_time: avgN,
        notes: notes.trim() || null,
      });
      setBest("");
      setAvg("");
      setNotes("");
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Speed progression</h2>
        <p className="text-xs text-slate-500">Track 10m / 20m / 30m fly splits.</p>
      </div>

      <form
        onSubmit={submit}
        className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-6 gap-3"
      >
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Distance</label>
          <select
            value={distance}
            onChange={(e) => setDistance(Number(e.target.value) as Distance)}
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          >
            {DISTANCES.map((d) => (
              <option key={d} value={d}>
                {d}m fly
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Best (s)</label>
          <input
            type="number"
            step="0.01"
            value={best}
            onChange={(e) => setBest(e.target.value)}
            placeholder="e.g. 1.02"
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Avg (s)</label>
          <input
            type="number"
            step="0.01"
            value={avg}
            onChange={(e) => setAvg(e.target.value)}
            placeholder="e.g. 1.08"
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            required
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          />
        </div>
        <div className="col-span-2 sm:col-span-1 flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Add split"}
          </button>
        </div>
        {formErr && (
          <p className="col-span-full text-xs text-red-600">{formErr}</p>
        )}
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h3 className="font-semibold text-sm">
            {metricMeta.label} over time
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {METRIC_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMetric(m.value)}
                  className={[
                    "px-3 py-1 rounded-full text-xs font-medium border",
                    metric === m.value
                      ? "bg-sky-600 text-white border-sky-600"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <div className="flex gap-1">
              {DISTANCES.map((d) => (
                <button
                  key={d}
                  onClick={() => setFilter(d)}
                  className={[
                    "px-3 py-1 rounded-full text-xs font-medium border",
                    filter === d
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="h-72">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No {filter}m splits yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={11} stroke="#64748b" />
                <YAxis
                  fontSize={11}
                  stroke="#64748b"
                  domain={["auto", "auto"]}
                  tickFormatter={(v) =>
                    `${Number(v).toFixed(metricMeta.decimals)}${metric === "time" ? "s" : ""}`
                  }
                />
                <Tooltip content={<SplitTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="best"
                  name={`Best (${metricMeta.unit})`}
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  name={`Average (${metricMeta.unit})`}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Lower is better when viewing split time; higher is better for m/s, kph, and mph.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="font-semibold text-sm mb-3">Recent entries</h3>
        {loading ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : splits.length === 0 ? (
          <p className="text-xs text-slate-400">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 text-left">
                <tr>
                  <th className="py-1.5 pr-3">Date</th>
                  <th className="py-1.5 pr-3">Distance</th>
                  <th className="py-1.5 pr-3">Best</th>
                  <th className="py-1.5 pr-3">Avg</th>
                  <th className="py-1.5 pr-3">Best m/s</th>
                  <th className="py-1.5 pr-3">Best kph</th>
                  <th className="py-1.5 pr-3">Best mph</th>
                  <th className="py-1.5 pr-3">Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...splits]
                  .reverse()
                  .slice(0, 20)
                  .map((s) => {
                    const bt = Number(s.best_time);
                    const at = Number(s.avg_time);
                    const ms = toMs(s.distance, bt);
                    return (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="py-1.5 pr-3">{s.date}</td>
                        <td className="py-1.5 pr-3">{s.distance}m</td>
                        <td className="py-1.5 pr-3">{bt.toFixed(2)}s</td>
                        <td className="py-1.5 pr-3">{at.toFixed(2)}s</td>
                        <td className="py-1.5 pr-3">{ms.toFixed(2)}</td>
                        <td className="py-1.5 pr-3">{(ms * MS_TO_KPH).toFixed(2)}</td>
                        <td className="py-1.5 pr-3">{(ms * MS_TO_MPH).toFixed(2)}</td>
                        <td className="py-1.5 pr-3 text-slate-500">{s.notes ?? "—"}</td>
                        <td className="py-1.5 pr-3 text-right">
                          <button
                            onClick={() => remove(s.id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-xs p-3">
          {error}
        </div>
      )}
    </div>
  );
}

function SplitTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload as ChartPoint;
  const row = (caption: string, time: number, ms: number, kph: number, mph: number, color: string) => (
    <div className="mt-2 first:mt-0">
      <p className="text-xs font-semibold" style={{ color }}>{caption}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-slate-700 mt-0.5">
        <span className="text-slate-500">Time</span>
        <span className="text-right tabular-nums">{time.toFixed(2)} s</span>
        <span className="text-slate-500">m/s</span>
        <span className="text-right tabular-nums">{ms.toFixed(2)}</span>
        <span className="text-slate-500">kph</span>
        <span className="text-right tabular-nums">{kph.toFixed(2)}</span>
        <span className="text-slate-500">mph</span>
        <span className="text-right tabular-nums">{mph.toFixed(2)}</span>
      </div>
    </div>
  );
  return (
    <div className="rounded-md border border-slate-200 bg-white shadow-md px-3 py-2 min-w-[200px]">
      <p className="text-xs font-medium text-slate-900">{label}</p>
      {row("Best", p.best_time, p.best_ms, p.best_kph, p.best_mph, "#0ea5e9")}
      {row("Average", p.avg_time, p.avg_ms, p.avg_kph, p.avg_mph, "#f59e0b")}
      {p.notes && (
        <p className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
          {p.notes}
        </p>
      )}
    </div>
  );
}
