import { withApiAuth } from "@/lib/api/route";
import { preflight } from "@/lib/api/with-api-auth";
import { passwordRangeEndpoint } from "@/lib/api/endpoints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiAuth(passwordRangeEndpoint);
export const OPTIONS = preflight(true);
