import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { exportCsv, exportJson, type CsvTable } from "../lib/exportData";

export default function ExportMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function run(kind: "json" | CsvTable) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "json") await exportJson(user.id);
      else await exportCsv(user.id, kind);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="text-xs text-slate-600 hover:text-slate-900 underline disabled:opacity-60"
      >
        {busy ? "Exporting…" : "Export"}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-md shadow-lg z-30 py-1 text-sm">
          <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-400">
            JSON
          </p>
          <button
            onClick={() => run("json")}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
          >
            All data (1 file)
          </button>
          <div className="my-1 border-t border-slate-100" />
          <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-400">
            CSV
          </p>
          <button
            onClick={() => run("all")}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
          >
            All tables (3 files)
          </button>
          <button
            onClick={() => run("sessions")}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
          >
            Training sessions
          </button>
          <button
            onClick={() => run("splits")}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
          >
            Speed splits
          </button>
          <button
            onClick={() => run("weights")}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-100"
          >
            Body weight
          </button>
          {error && (
            <p className="px-3 py-1.5 text-xs text-red-600 border-t border-slate-100 mt-1">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
