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

// Provide the native WebSocket constructor for Supabase Realtime.
// In a browser it's globalThis.WebSocket. In Node/SSR we provide a no-op fallback
// because the app does not actually subscribe to any realtime channels.
const wsConstructor =
  (typeof globalThis !== 'undefined' && globalThis.WebSocket) ||
  (typeof WebSocket !== 'undefined' && WebSocket) ||
  (class NoOpWebSocket {
    constructor() {}
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  } as any);

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    realtime: {
      transport: wsConstructor,
    },
  } as any,
);
