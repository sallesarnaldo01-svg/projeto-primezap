import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined);
const STORAGE_KEY = 'primezapai-auth';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Minimal no-op supabase stub to avoid runtime crashes when env is missing
function createNoopSupabase(): SupabaseClient<Database> {
  const chain: any = {
    select: async () => ({ data: [], error: null }),
    insert: async () => ({ data: null, error: new Error('Supabase não configurado') }),
    update: async () => ({ data: null, error: new Error('Supabase não configurado') }),
    delete: async () => ({ data: null, error: new Error('Supabase não configurado') }),
    upsert: async () => ({ data: null, error: new Error('Supabase não configurado') }),
    eq: () => chain,
    order: () => chain,
  };

  const noopClient: any = {
    auth: {
      signInWithOAuth: async () => ({ data: { url: undefined }, error: new Error('Supabase não configurado') }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: new Error('Supabase não configurado') }),
      }),
    },
    functions: {
      invoke: async () => ({ data: null, error: new Error('Supabase não configurado') }),
    },
    from: () => chain,
    channel: () => ({
      on: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) }),
      subscribe: () => ({}),
    }),
    removeChannel: () => {},
  };

  if (typeof console !== 'undefined') {
    console.warn('[supabase] Variáveis de ambiente não configuradas. Recursos Realtime/Storage/Functions ficarão indisponíveis.');
  }

  return noopClient as SupabaseClient<Database>;
}

type GlobalWithSupabase = typeof globalThis & {
  __PRIMEZAP_SUPABASE__?: SupabaseClient<Database>;
};

const globalForSupabase = globalThis as GlobalWithSupabase;

export const supabase: SupabaseClient<Database> =
  globalForSupabase.__PRIMEZAP_SUPABASE__ ??
  (isSupabaseConfigured
    ? createClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: {
          storageKey: STORAGE_KEY,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : createNoopSupabase());

if (!globalForSupabase.__PRIMEZAP_SUPABASE__) {
  globalForSupabase.__PRIMEZAP_SUPABASE__ = supabase;
}

export default supabase;
