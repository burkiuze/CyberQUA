import "server-only";
import { auth } from "@clerk/nextjs/server";

export function authConfigured(): boolean {
  return !!process.env.CLERK_SECRET_KEY;
}

/** Current Clerk user id, or null when signed out or auth is not configured yet. */
export async function currentUserId(): Promise<string | null> {
  if (!authConfigured()) return null;
  const { userId } = await auth();
  return userId;
}
