import { supabase } from "./supabase";
import type { Session, Split, Weight } from "./types";

export interface ExportBundle {
  exported_at: string;
  user_id: string;
  sessions: Session[];
  splits: Split[];
  weights: Weight[];
}

async function fetchAll(userId: string): Promise<ExportBundle> {
  const [sessionsRes, splitsRes, weightsRes] = await Promise.all([
    supabase.from("sessions").select("*").order("date", { ascending: true }),
    supabase.from("splits").select("*").order("date", { ascending: true }),
    supabase.from("weights").select("*").order("date", { ascending: true }),
  ]);
  const firstError = sessionsRes.error ?? splitsRes.error ?? weightsRes.error;
  if (firstError) throw new Error(firstError.message);
  return {
    exported_at: new Date().toISOString(),
    user_id: userId,
    sessions: (sessionsRes.data ?? []) as Session[],
    splits: (splitsRes.data ?? []) as Split[],
    weights: (weightsRes.data ?? []) as Weight[],
  };
}

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const columns = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set()),
  );
  const header = columns.join(",");
  const body = rows.map((r) => columns.map((c) => escapeCsv(r[c])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

function download(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function exportJson(userId: string): Promise<void> {
  const bundle = await fetchAll(userId);
  download(
    `hurdles-dashboard-${stamp()}.json`,
    JSON.stringify(bundle, null, 2),
    "application/json",
  );
}

export type CsvTable = "sessions" | "splits" | "weights" | "all";

export async function exportCsv(userId: string, table: CsvTable): Promise<void> {
  const bundle = await fetchAll(userId);
  const tables: { name: Exclude<CsvTable, "all">; rows: Record<string, unknown>[] }[] = [
    { name: "sessions", rows: bundle.sessions as unknown as Record<string, unknown>[] },
    { name: "splits",   rows: bundle.splits   as unknown as Record<string, unknown>[] },
    { name: "weights",  rows: bundle.weights  as unknown as Record<string, unknown>[] },
  ];
  const targets = table === "all" ? tables : tables.filter((t) => t.name === table);
  for (const t of targets) {
    const csv = rowsToCsv(t.rows);
    download(`hurdles-dashboard-${t.name}-${stamp()}.csv`, csv, "text/csv");
  }
}
