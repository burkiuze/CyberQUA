import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!client) {
    client = createClient(serverEnv.supabaseUrl(), serverEnv.supabasePublishableKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-application-name": "cyberqua" } },
    });
  }
  return client;
}

/**
 * Calls a `cq_*` database function. All CyberQUA data lives in a private schema
 * that is not exposed through the Data API; these SECURITY DEFINER functions are
 * the only way in and each one verifies the server-only CYBERQUA_DB_SECRET.
 */
export async function rpc<T>(fn: `cq_${string}`, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc(fn, { p_secret: serverEnv.dbSecret(), ...args });
  if (error) throw new Error(`db_${fn}_failed`);
  return data as T;
}
