import { withApiAuth } from "@/lib/api/route";
import { preflight } from "@/lib/api/with-api-auth";
import { emailCheckEndpoint } from "@/lib/api/endpoints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiAuth(emailCheckEndpoint);
export const OPTIONS = preflight(true);
