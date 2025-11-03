import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let supabaseAdmin: SupabaseClient | undefined;

if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
} else {
  logger.warn(
    'Supabase admin client not initialized. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.'
  );
}

export { supabaseAdmin };
