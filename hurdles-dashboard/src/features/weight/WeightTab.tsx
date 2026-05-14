import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { differenceInCalendarDays, parseISO, subDays } from "date-fns";
import { useWeights } from "./useWeights";

type Range = "30d" | "90d" | "1y" | "all";

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "1y", label: "1y" },
  { value: "all", label: "All" },
];

function nearestBefore(
  rows: { date: string; weight_kg: number }[],
  target: Date,
): number | null {
  let best: { date: string; weight_kg: number } | null = null;
  for (const r of rows) {
    const d = parseISO(r.date);
    if (d <= target) {
      if (!best || d > parseISO(best.date)) best = r;
    }
  }
  return best ? Number(best.weight_kg) : null;
}

export default function WeightTab() {
  const { weights, loading, error, upsert } = useWeights();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [kg, setKg] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("30d");

  const latest = weights.length ? weights[weights.length - 1] : null;
  const latestVal = latest ? Number(latest.weight_kg) : null;

  const delta7 = useMemo(() => {
    if (!latest || !latestVal) return null;
    const prev = nearestBefore(weights, subDays(parseISO(latest.date), 7));
    return prev !== null ? latestVal - prev : null;
  }, [weights, latest, latestVal]);

  const delta30 = useMemo(() => {
    if (!latest || !latestVal) return null;
    const prev = nearestBefore(weights, subDays(parseISO(latest.date), 30));
    return prev !== null ? latestVal - prev : null;
  }, [weights, latest, latestVal]);

  const chartData = useMemo(() => {
    const today = new Date();
    const cutoffDays =
      range === "30d" ? 30 : range === "90d" ? 90 : range === "1y" ? 365 : Infinity;
    return weights
      .filter((w) => differenceInCalendarDays(today, parseISO(w.date)) <= cutoffDays)
      .map((w) => ({ date: w.date, kg: Number(w.weight_kg) }));
  }, [weights, range]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    const n = parseFloat(kg);
    if (!Number.isFinite(n) || n <= 0) {
      setFormErr("Enter weight in kg.");
      return;
    }
    setBusy(true);
    try {
      await upsert(date, n);
      setKg("");
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  function fmtDelta(d: number | null) {
    if (d === null) return "—";
    const sign = d > 0 ? "+" : "";
    return `${sign}${d.toFixed(1)} kg`;
  }

  function deltaClass(d: number | null) {
    if (d === null) return "text-slate-400";
    if (Math.abs(d) < 0.05) return "text-slate-500";
    return d < 0 ? "text-emerald-600" : "text-amber-600";
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Body weight</h2>
        <p className="text-xs text-slate-500">Log daily; trends matter more than any single reading.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-slate-500">Current weight</p>
            <p className="text-3xl font-bold tracking-tight">
              {latestVal !== null ? `${latestVal.toFixed(1)} kg` : "—"}
            </p>
            {latest && (
              <p className="text-xs text-slate-400 mt-0.5">as of {latest.date}</p>
            )}
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-xs text-slate-500">vs 7 days</p>
              <p className={`font-semibold ${deltaClass(delta7)}`}>{fmtDelta(delta7)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">vs 30 days</p>
              <p className={`font-semibold ${deltaClass(delta30)}`}>{fmtDelta(delta30)}</p>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Weight (kg)</label>
          <input
            type="number"
            step="0.1"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder="e.g. 72.4"
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            required
          />
        </div>
        <div className="col-span-2 sm:col-span-2 flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save weight"}
          </button>
        </div>
        {formErr && <p className="col-span-full text-xs text-red-600">{formErr}</p>}
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Trend</h3>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={[
                  "px-3 py-1 rounded-full text-xs font-medium border",
                  range === r.value
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100",
                ].join(" ")}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-72">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Loading…
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No entries in this range.
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
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)} kg`} />
                <Line
                  type="monotone"
                  dataKey="kg"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-xs p-3">
          {error}
        </div>
      )}
    </div>
  );
}
