import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

type AnySupabaseClient = SupabaseClient<any, any, any>;

const resolveSupabaseClient = (): AnySupabaseClient => {
  const url =
    env.SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    '';
  const serviceKey =
    env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    '';

  if (url && serviceKey) {
    return createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  console.warn(
    '[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Supabase-backed endpoints will throw until these variables are configured.',
  );

  return new Proxy(
    {},
    {
      get() {
        return () => {
          throw new Error(
            'Supabase client not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.',
          );
        };
      },
    },
  ) as AnySupabaseClient;
};

export const supabase = resolveSupabaseClient();
