const env = import.meta.env as Record<string, string | undefined>;
export const SUPABASE_URL = env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
/** Accounts are only offered when a Supabase project is configured. */
export const syncConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
