import { withApiAuth } from "@/lib/api/route";
import { preflight } from "@/lib/api/with-api-auth";
import { ipEndpoint } from "@/lib/api/endpoints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiAuth(ipEndpoint);
export const OPTIONS = preflight(false);
