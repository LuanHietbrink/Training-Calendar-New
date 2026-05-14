import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Surfaced in the UI rather than crashing the bundle.
  console.warn(
    "Supabase env vars missing. Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient(url ?? "http://localhost", anonKey ?? "public-anon-key");

export const supabaseConfigured = Boolean(url && anonKey);
