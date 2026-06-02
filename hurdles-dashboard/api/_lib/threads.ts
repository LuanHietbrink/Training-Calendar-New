import { getSupabaseAdmin } from "./supabaseAdmin";
import type { StoredTurn } from "./agent";

/**
 * Conversation memory keyed by WhatsApp phone number, stored in the
 * `whatsapp_threads` table (RLS-enabled with no policies, so only the
 * service-role client can read/write it).
 */

export async function loadThread(phone: string): Promise<StoredTurn[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("whatsapp_threads")
    .select("messages")
    .eq("phone", phone)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const messages = (data?.messages ?? []) as StoredTurn[];
  return Array.isArray(messages) ? messages : [];
}

export async function saveThread(phone: string, turns: StoredTurn[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("whatsapp_threads")
    .upsert(
      { phone, messages: turns, updated_at: new Date().toISOString() },
      { onConflict: "phone" },
    );
  if (error) throw new Error(error.message);
}
