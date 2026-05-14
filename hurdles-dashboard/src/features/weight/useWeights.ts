import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import type { Weight } from "../../lib/types";

export function useWeights() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Weight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("weights")
      .select("*")
      .order("date", { ascending: true });
    if (error) setError(error.message);
    else setRows((data ?? []) as Weight[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upsert = useCallback(
    async (date: string, weight_kg: number) => {
      if (!user) return;
      const { error } = await supabase
        .from("weights")
        .upsert(
          { user_id: user.id, date, weight_kg },
          { onConflict: "user_id,date" },
        );
      if (error) throw new Error(error.message);
      await refresh();
    },
    [user, refresh],
  );

  return { weights: rows, loading, error, upsert };
}
