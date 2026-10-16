import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let admin: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the secret key. It bypasses RLS, so every
 * query MUST be scoped to the authenticated Clerk user id by the caller.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    admin = createClient(serverEnv.supabaseUrl(), serverEnv.supabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-application-name": "cyberqua" } },
    });
  }
  return admin;
}
