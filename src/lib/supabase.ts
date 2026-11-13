import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
    : undefined;

const supabasePublishableKey =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (
        (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
        (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
      )?.trim()
    : undefined;

export const isSupabaseClientConfigured = !!(
  supabaseUrl &&
  supabasePublishableKey &&
  supabaseUrl.startsWith('http')
);

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseClientConfigured || !supabaseUrl || !supabasePublishableKey) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return clientInstance;
}

export const supabase = getSupabaseClient();
