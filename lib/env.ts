import "server-only";

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function required(name: string): string {
  const value = optional(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const serverEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY"),
  redisUrl: () => required("UPSTASH_REDIS_REST_URL"),
  redisToken: () => required("UPSTASH_REDIS_REST_TOKEN"),
  abuseIpDbKey: () => optional("ABUSEIPDB_API_KEY"),
  urlhausKey: () => optional("URLHAUS_AUTH_KEY"),
  webRiskKey: () => optional("GOOGLE_WEB_RISK_API_KEY"),
  clerkWebhookSecret: () => optional("CLERK_WEBHOOK_SIGNING_SECRET"),
};

export function siteUrl(): string {
  return (optional("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
}
