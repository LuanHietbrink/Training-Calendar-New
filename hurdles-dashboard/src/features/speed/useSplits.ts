import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import type { Split } from "../../lib/types";

export type SplitInput = Omit<Split, "id" | "user_id">;

export function useSplits() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Split[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("splits")
      .select("*")
      .order("date", { ascending: true });
    if (error) setError(error.message);
    else setRows((data ?? []) as Split[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: SplitInput) => {
      if (!user) return;
      const { error } = await supabase
        .from("splits")
        .insert({ ...input, user_id: user.id });
      if (error) throw new Error(error.message);
      await refresh();
    },
    [user, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("splits").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await refresh();
    },
    [refresh],
  );

  return { splits: rows, loading, error, create, remove };
}
