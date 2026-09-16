import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/**
 * Returns true when both Supabase env vars are configured.
 * All sync code should check this before attempting remote calls.
 */
export function isSupabaseConfigured(): boolean {
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}

let _supabase: SupabaseClient | null = null;

/**
 * Lazy-initialise the Supabase client.
 * The client is only created when sync actually runs, which avoids the
 * WebSocket constructor lookup during Metro SSR (Node) and when the app is
 * used entirely offline.
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-key',
    );
  }
  return _supabase;
}
