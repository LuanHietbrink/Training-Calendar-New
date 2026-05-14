import { useCallback, useEffect, useState } from "react";
import { addDays, addYears, format, isAfter, parseISO } from "date-fns";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import type { Session, SessionInput } from "../../lib/types";

export interface SessionOccurrence extends Session {
  occurrenceId: string;    // unique per rendered date (parentId + date)
  occurrenceDate: string;  // YYYY-MM-DD
  isRecurringChild: boolean;
}

const MAX_HORIZON_DAYS = 365;

function expand(sessions: Session[]): SessionOccurrence[] {
  const out: SessionOccurrence[] = [];
  const horizon = addYears(new Date(), 1);
  for (const s of sessions) {
    if (s.recurrence !== "weekly") {
      out.push({
        ...s,
        occurrenceId: s.id,
        occurrenceDate: s.date,
        isRecurringChild: false,
      });
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
        occurrenceId: `${s.id}::${dateStr}`,
        occurrenceDate: dateStr,
        isRecurringChild: dateStr !== s.date,
        // Recurring child instances are not "completed" — only the seed row
        // tracks completion. Children always render as planned.
        completed: dateStr === s.date ? s.completed : false,
        actual_notes: dateStr === s.date ? s.actual_notes : null,
      });
      cursor = addDays(cursor, 7);
      i += 1;
    }
  }
  return out;
}

export function useSessions() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("date", { ascending: true });
    if (error) setError(error.message);
    else setRows((data ?? []) as Session[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: SessionInput) => {
      if (!user) return;
      const { error } = await supabase
        .from("sessions")
        .insert({ ...input, user_id: user.id });
      if (error) throw new Error(error.message);
      await refresh();
    },
    [user, refresh],
  );

  const update = useCallback(
    async (id: string, patch: Partial<SessionInput>) => {
      const { error } = await supabase.from("sessions").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("sessions").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await refresh();
    },
    [refresh],
  );

  return {
    sessions: rows,
    occurrences: expand(rows),
    loading,
    error,
    create,
    update,
    remove,
    refresh,
  };
}
