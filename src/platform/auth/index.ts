import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "../db";
import type { Actor } from "../rbac/can";
import { SESSION_COOKIE, readSessionToken } from "./session-token";

export type CurrentUser = Actor & { email: string };

/** The signed-in user, or null. All auth lives here, so OIDC (Okta or Entra ID) can replace it without touching any tool. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const userId = readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } });
});
