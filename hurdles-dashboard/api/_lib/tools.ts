import { addDays, addYears, format, isAfter, parseISO } from "date-fns";
import { getSupabaseAdmin, ownerUserId } from "./supabaseAdmin";

/**
 * Supabase-backed tool implementations for the WhatsApp agent.
 * Every query is scoped to OWNER_USER_ID because the service-role client
 * bypasses RLS.
 *
 * Schema reference (see README / src/lib/types.ts):
 *   sessions(date, start_time, session_type, intensity, title,
 *            planned_notes, actual_notes, completed, recurrence, recurrence_until)
 *   splits(date, distance, best_time, avg_time, notes)
 *   weights(date, weight_kg)
 *
 * Per-exercise loads (e.g. "bench press 80kg") are NOT a structured column —
 * they live in the free-text `title` / `actual_notes`. The agent reads those
 * fields to answer load questions.
 */

export const SESSION_TYPES = ["Hurdles", "Speed", "Tempo", "Gym", "Recovery", "Other"] as const;
export const INTENSITIES = ["High", "Medium", "Low"] as const;

interface SessionRow {
  id: string;
  date: string;
  start_time: string | null;
  session_type: string;
  intensity: string;
  title: string;
  planned_notes: string | null;
  actual_notes: string | null;
  completed: boolean;
  recurrence: string | null;
  recurrence_until: string | null;
}

interface Occurrence extends SessionRow {
  occurrence_date: string;
  is_recurring_child: boolean;
}

const MAX_HORIZON_DAYS = 365;

/**
 * Expand weekly-recurring seed rows into per-date occurrences, mirroring the
 * dashboard's client-side logic (src/features/training/useSessions.ts `expand`).
 * Without this, counting raw rows undercounts recurring sessions.
 */
export function expand(sessions: SessionRow[]): Occurrence[] {
  const out: Occurrence[] = [];
  const horizon = addYears(new Date(), 1);
  for (const s of sessions) {
    if (s.recurrence !== "weekly") {
      out.push({ ...s, occurrence_date: s.date, is_recurring_child: false });
      continue;
    }
    const start = parseISO(s.date);
    const end = s.recurrence_until ? parseISO(s.recurrence_until) : horizon;
    const cap = isAfter(end, horizon) ? horizon : end;
    let cursor = start;
    let i = 0;
    while (!isAfter(cursor, cap) && i < MAX_HORIZON_DAYS) {
      const dateStr = format(cursor, "yyyy-MM-dd");
      out.push({
        ...s,
        date: dateStr,
        occurrence_date: dateStr,
        is_recurring_child: dateStr !== s.date,
        // Only the seed row tracks completion; recurring children are "planned".
        completed: dateStr === s.date ? s.completed : false,
        actual_notes: dateStr === s.date ? s.actual_notes : null,
      });
      cursor = addDays(cursor, 7);
      i += 1;
    }
  }
  return out;
}

export interface QuerySessionsInput {
  date_from?: string;
  date_to?: string;
  session_type?: string;
  completed?: boolean;
  text_search?: string;
  limit?: number;
}

export async function querySessions(input: QuerySessionsInput) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", ownerUserId())
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);

  let occ = expand((data ?? []) as SessionRow[]);

  if (input.date_from) occ = occ.filter((o) => o.occurrence_date >= input.date_from!);
  if (input.date_to) occ = occ.filter((o) => o.occurrence_date <= input.date_to!);
  if (input.session_type) {
    const t = input.session_type.toLowerCase();
    occ = occ.filter((o) => o.session_type.toLowerCase() === t);
  }
  if (typeof input.completed === "boolean") {
    occ = occ.filter((o) => o.completed === input.completed);
  }
  if (input.text_search) {
    const q = input.text_search.toLowerCase();
    occ = occ.filter((o) =>
      [o.title, o.planned_notes, o.actual_notes]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q)),
    );
  }

  const count = occ.length;
  const limit = Math.min(input.limit ?? 50, 100);
  const sessions = occ.slice(0, limit).map((o) => ({
    id: o.id,
    date: o.occurrence_date,
    start_time: o.start_time,
    session_type: o.session_type,
    intensity: o.intensity,
    title: o.title,
    planned_notes: o.planned_notes,
    actual_notes: o.actual_notes,
    completed: o.completed,
    is_recurring_child: o.is_recurring_child,
  }));

  return { count, returned: sessions.length, sessions };
}

export interface AddSessionInput {
  date: string;
  start_time?: string | null;
  session_type: string;
  intensity: string;
  title: string;
  planned_notes?: string | null;
  actual_notes?: string | null;
  completed?: boolean;
}

export async function addSession(input: AddSessionInput) {
  if (!SESSION_TYPES.includes(input.session_type as (typeof SESSION_TYPES)[number])) {
    throw new Error(`Invalid session_type. Must be one of: ${SESSION_TYPES.join(", ")}`);
  }
  if (!INTENSITIES.includes(input.intensity as (typeof INTENSITIES)[number])) {
    throw new Error(`Invalid intensity. Must be one of: ${INTENSITIES.join(", ")}`);
  }
  if (!input.title?.trim()) throw new Error("title is required");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: ownerUserId(),
      date: input.date,
      start_time: input.start_time ?? null,
      session_type: input.session_type,
      intensity: input.intensity,
      title: input.title.trim(),
      planned_notes: input.planned_notes ?? null,
      actual_notes: input.actual_notes ?? null,
      completed: input.completed ?? false,
      recurrence: null,
      recurrence_until: null,
    })
    .select("id, date, session_type, intensity, title")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, session: data };
}

export interface UpdateSessionInput {
  id: string;
  completed?: boolean;
  title?: string;
  start_time?: string | null;
  session_type?: string;
  intensity?: string;
  planned_notes?: string | null;
  actual_notes?: string | null;
}

export async function updateSession(input: UpdateSessionInput) {
  const { id, ...patch } = input;
  if (!id) throw new Error("id is required");
  // Drop undefined keys so we only patch provided fields.
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) clean[k] = v;
  }
  if (Object.keys(clean).length === 0) throw new Error("No fields to update");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sessions")
    .update(clean)
    .eq("id", id)
    .eq("user_id", ownerUserId())
    .select("id, date, session_type, title, completed")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, session: data };
}

export interface QueryWeightsInput {
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export async function queryWeights(input: QueryWeightsInput) {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("weights")
    .select("date, weight_kg")
    .eq("user_id", ownerUserId())
    .order("date", { ascending: false });
  if (input.date_from) q = q.gte("date", input.date_from);
  if (input.date_to) q = q.lte("date", input.date_to);
  q = q.limit(Math.min(input.limit ?? 30, 100));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { count: data?.length ?? 0, weights: data ?? [] };
}

export interface QuerySplitsInput {
  date_from?: string;
  date_to?: string;
  distance?: number;
  limit?: number;
}

export async function querySplits(input: QuerySplitsInput) {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("splits")
    .select("date, distance, best_time, avg_time, notes")
    .eq("user_id", ownerUserId())
    .order("date", { ascending: false });
  if (input.date_from) q = q.gte("date", input.date_from);
  if (input.date_to) q = q.lte("date", input.date_to);
  if (input.distance) q = q.eq("distance", input.distance);
  q = q.limit(Math.min(input.limit ?? 30, 100));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { count: data?.length ?? 0, splits: data ?? [] };
}

/** Dispatch a tool call by name. Returns a JSON-serialisable result. */
export async function runTool(name: string, input: unknown): Promise<unknown> {
  switch (name) {
    case "query_sessions":
      return querySessions(input as QuerySessionsInput);
    case "add_session":
      return addSession(input as AddSessionInput);
    case "update_session":
      return updateSession(input as UpdateSessionInput);
    case "query_weights":
      return queryWeights(input as QueryWeightsInput);
    case "query_splits":
      return querySplits(input as QuerySplitsInput);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
