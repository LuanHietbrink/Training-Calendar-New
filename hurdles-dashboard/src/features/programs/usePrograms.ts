import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import type { Program, ProgramFileType } from "../../lib/types";

export function usePrograms() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("programs")
      .select("*")
      .order("uploaded_at", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setPrograms((data ?? []) as Program[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const upload = useCallback(
    async (file: File, displayName: string, fileType: ProgramFileType) => {
      if (!user) return;
      const ext = file.name.split(".").pop() ?? fileType;
      const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from("training-programs")
        .upload(storagePath, file, { contentType: file.type });
      if (storageError) throw new Error(storageError.message);

      const { error: dbError } = await supabase.from("programs").insert({
        user_id: user.id,
        name: displayName,
        file_path: storagePath,
        file_type: fileType,
        file_size: file.size,
      });
      if (dbError) {
        await supabase.storage.from("training-programs").remove([storagePath]);
        throw new Error(dbError.message);
      }
      await refresh();
    },
    [user, refresh],
  );

  const getSignedUrl = useCallback(async (filePath: string): Promise<string> => {
    const { data, error: urlError } = await supabase.storage
      .from("training-programs")
      .createSignedUrl(filePath, 60);
    if (urlError || !data) throw new Error(urlError?.message ?? "Could not get signed URL");
    return data.signedUrl;
  }, []);

  const remove = useCallback(
    async (program: Program) => {
      await supabase.storage.from("training-programs").remove([program.file_path]);
      const { error: dbError } = await supabase
        .from("programs")
        .delete()
        .eq("id", program.id);
      if (dbError) throw new Error(dbError.message);
      await refresh();
    },
    [refresh],
  );

  return { programs, loading, error, upload, getSignedUrl, remove, refresh };
}
