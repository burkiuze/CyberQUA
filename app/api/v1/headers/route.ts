import { withApiAuth } from "@/lib/api/route";
import { preflight } from "@/lib/api/with-api-auth";
import { headersEndpoint } from "@/lib/api/endpoints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const GET = withApiAuth(headersEndpoint);
export const OPTIONS = preflight(false);
