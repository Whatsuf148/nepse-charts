import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Remote } from './engine';
import type { Doc } from './merge';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

// This module is imported lazily so the Supabase SDK stays out of the main bundle.
let client: SupabaseClient | null = null;
export function getClient() {
  client ??= createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);
  return client;
}

export function supabaseRemote(sb: SupabaseClient, userId: string): Remote {
  return {
    async pull() {
      const { data, error } = await sb
        .from('user_state')
        .select('data,updated,version')
        .eq('user_id', userId)
        .limit(1);
      if (error) throw new Error(error.message);
      const row = data?.[0];
      return row ? { doc: { data: row.data ?? {}, updated: row.updated ?? {} } as Doc, version: row.version as number } : null;
    },

    async push(doc, version) {
      if (version === null) {
        const { error } = await sb.from('user_state').insert({ user_id: userId, data: doc.data, updated: doc.updated });
        if (!error) return true;
        if (error.code === '23505') return false; // another device created the row first
        throw new Error(error.message);
      }
      const { data, error } = await sb
        .from('user_state')
        .update({ data: doc.data, updated: doc.updated, version: version + 1, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('version', version)
        .select('version');
      if (error) throw new Error(error.message);
      return (data?.length ?? 0) > 0; // 0 rows = version moved on; the engine re-pulls and retries
    },
  };
}
