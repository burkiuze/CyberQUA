import { withApiAuth } from "@/lib/api/route";
import { preflight } from "@/lib/api/with-api-auth";
import { urlCheckEndpoint } from "@/lib/api/endpoints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiAuth(urlCheckEndpoint);
export const OPTIONS = preflight(true);
