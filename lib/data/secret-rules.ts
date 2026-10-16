import type { Severity } from "@/lib/checks/text";

export interface SecretRule {
  id: string;
  name: string;
  /** Provider shown in remediation advice. */
  provider: string;
  /** Must use the `g` flag. Capture group 1 (when present) is the secret value. */
  regex: RegExp;
  severity: Severity;
  /** Where the key can be revoked / rotated. */
  revokeUrl: string;
  /** Suggested environment variable name. */
  envVar: string;
  /** Optional extra validation of the matched secret. */
  validate?: (secret: string) => boolean;
}

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/** True when the JWT payload carries `"role": "service_role"`. */
export function isSupabaseServiceRoleJwt(token: string): boolean {
  const payload = token.split(".")[1];
  if (!payload) return false;
  const json = decodeBase64Url(payload);
  if (!json) return false;
  try {
    const claims = JSON.parse(json) as { role?: unknown };
    return claims.role === "service_role";
  } catch {
    return false;
  }
}

/**
 * Ordered from most to least specific. When two rules match overlapping
 * text, the earlier rule wins.
 */
export const SECRET_RULES: SecretRule[] = [
  {
    id: "openrouter-api-key",
    name: "OpenRouter API Key",
    provider: "OpenRouter",
    regex: /\b(sk-or-v1-[a-f0-9]{64})\b/g,
    severity: "critical",
    revokeUrl: "https://openrouter.ai/settings/keys",
    envVar: "OPENROUTER_API_KEY",
  },
  {
    id: "anthropic-api-key",
    name: "Anthropic API Key",
    provider: "Anthropic",
    regex: /\b(sk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{80,120})(?![A-Za-z0-9_-])/g,
    severity: "critical",
    revokeUrl: "https://console.anthropic.com/settings/keys",
    envVar: "ANTHROPIC_API_KEY",
  },
  {
    id: "openai-project-key",
    name: "OpenAI Project API Key",
    provider: "OpenAI",
    regex: /\b(sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{40,200})(?![A-Za-z0-9_-])/g,
    severity: "critical",
    revokeUrl: "https://platform.openai.com/api-keys",
    envVar: "OPENAI_API_KEY",
  },
  {
    id: "openai-api-key",
    name: "OpenAI API Key",
    provider: "OpenAI",
    regex: /\b(sk-(?!ant-|or-|proj-|svcacct-|admin-)[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}|sk-(?!ant-|or-|proj-|svcacct-|admin-)[A-Za-z0-9]{48})\b/g,
    severity: "critical",
    revokeUrl: "https://platform.openai.com/api-keys",
    envVar: "OPENAI_API_KEY",
  },
  {
    id: "google-api-key",
    name: "Google API Key",
    provider: "Google Cloud",
    regex: /\b(AIza[0-9A-Za-z_-]{35})(?![0-9A-Za-z_-])/g,
    severity: "high",
    revokeUrl: "https://console.cloud.google.com/apis/credentials",
    envVar: "GOOGLE_API_KEY",
  },
  {
    id: "github-fine-grained-pat",
    name: "GitHub Fine-grained Token",
    provider: "GitHub",
    regex: /\b(github_pat_[A-Za-z0-9_]{70,100})\b/g,
    severity: "critical",
    revokeUrl: "https://github.com/settings/tokens?type=beta",
    envVar: "GITHUB_TOKEN",
  },
  {
    id: "github-token",
    name: "GitHub Token",
    provider: "GitHub",
    regex: /\b((?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,255})\b/g,
    severity: "critical",
    revokeUrl: "https://github.com/settings/tokens",
    envVar: "GITHUB_TOKEN",
  },
  {
    id: "aws-access-key-id",
    name: "AWS Access Key ID",
    provider: "AWS",
    regex: /\b((?:AKIA|ASIA)[0-9A-Z]{16})\b/g,
    severity: "critical",
    revokeUrl: "https://console.aws.amazon.com/iam/home#/security_credentials",
    envVar: "AWS_ACCESS_KEY_ID",
  },
  {
    id: "stripe-live-key",
    name: "Stripe Live Secret Key",
    provider: "Stripe",
    regex: /\b((?:sk|rk)_live_[0-9a-zA-Z]{24,247})\b/g,
    severity: "critical",
    revokeUrl: "https://dashboard.stripe.com/apikeys",
    envVar: "STRIPE_SECRET_KEY",
  },
  {
    id: "supabase-service-role-jwt",
    name: "Supabase service_role JWT",
    provider: "Supabase",
    regex: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})(?![A-Za-z0-9_-])/g,
    severity: "critical",
    revokeUrl: "https://supabase.com/dashboard/project/_/settings/api-keys",
    envVar: "SUPABASE_SECRET_KEY",
    validate: isSupabaseServiceRoleJwt,
  },
  {
    id: "supabase-secret-key",
    name: "Supabase Secret Key",
    provider: "Supabase",
    regex: /\b(sb_secret_[A-Za-z0-9_-]{20,})(?![A-Za-z0-9_-])/g,
    severity: "critical",
    revokeUrl: "https://supabase.com/dashboard/project/_/settings/api-keys",
    envVar: "SUPABASE_SECRET_KEY",
  },
  {
    id: "slack-token",
    name: "Slack Token",
    provider: "Slack",
    regex: /\b(xox[abposr]-[A-Za-z0-9-]{10,250})\b/g,
    severity: "high",
    revokeUrl: "https://api.slack.com/apps",
    envVar: "SLACK_TOKEN",
  },
  {
    id: "telegram-bot-token",
    name: "Telegram Bot Token",
    provider: "Telegram (@BotFather)",
    regex: /\b(\d{8,10}:AA[A-Za-z0-9_-]{33})(?![A-Za-z0-9_-])/g,
    severity: "high",
    revokeUrl: "https://t.me/BotFather",
    envVar: "TELEGRAM_BOT_TOKEN",
  },
  {
    id: "discord-bot-token",
    name: "Discord Bot Token",
    provider: "Discord",
    regex: /\b([MNO][A-Za-z0-9_-]{23,27}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,40})(?![A-Za-z0-9_-])/g,
    severity: "high",
    revokeUrl: "https://discord.com/developers/applications",
    envVar: "DISCORD_BOT_TOKEN",
  },
  {
    id: "private-key",
    name: "Private Key",
    provider: "PKI / SSH",
    regex: /(-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----|$))/g,
    severity: "critical",
    revokeUrl: "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-ssh-keys",
    envVar: "PRIVATE_KEY",
  },
];

/** Assignment to a secret-sounding variable: key/secret/token/password = "value". */
export const GENERIC_ASSIGNMENT_RULE = {
  id: "generic-high-entropy-secret",
  name: "High-entropy secret in variable",
  provider: "",
  regex:
    /([A-Za-z0-9_.-]*(?:key|secret|token|passwd|password|pwd|credential|auth)[A-Za-z0-9_.-]*)["']?\s*(?:=|:|:=|=>)\s*["'`]?([^\s"'`;,)]{20,512})/gi,
  severity: "high" as Severity,
  revokeUrl: "",
  envVar: "",
  minEntropy: 4.0,
};
