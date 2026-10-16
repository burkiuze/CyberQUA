import "server-only";
import type { z } from "zod";
import { createApiHandler, type EndpointDef, type RouteContext } from "@/lib/api/with-api-auth";
import { defaultAuthDeps } from "@/lib/api/deps";

/**
 * Wraps an endpoint definition with API key auth, key-type rules, rate limit,
 * quota, validation, timing and usage logging.
 */
export function withApiAuth<S extends z.ZodType>(def: EndpointDef<S>) {
  let handler: ReturnType<typeof createApiHandler<S>> | null = null;
  return (req: Request, ctx: RouteContext) => {
    handler ??= createApiHandler(def, defaultAuthDeps());
    return handler(req, ctx);
  };
}
