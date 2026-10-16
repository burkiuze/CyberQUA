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
  supabasePublishableKey: () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  dbSecret: () => required("CYBERQUA_DB_SECRET"),
  clerkPublishableKey: () => required("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
  abuseIpDbKey: () => optional("ABUSEIPDB_API_KEY"),
  urlhausKey: () => optional("URLHAUS_AUTH_KEY"),
  webRiskKey: () => optional("GOOGLE_WEB_RISK_API_KEY"),
};

export function siteUrl(): string {
  return (optional("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
}
