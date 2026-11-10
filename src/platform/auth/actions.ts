"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "../audit";
import { prisma } from "../db";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken } from "./session-token";

const signInSchema = z.object({ userId: z.string().min(1) });

export async function signIn(formData: FormData) {
  const { userId } = signInSchema.parse({ userId: formData.get("userId") });
  const user = await prisma.$transaction(async (tx) => {
    const found = await tx.user.findUnique({ where: { id: userId } });
    if (!found) return null;
    await recordAudit(tx, { actor: found, action: "auth.sign_in", recordType: "user", recordId: found.id });
    return found;
  });
  if (!user) redirect("/sign-in");

  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect("/");
}

export async function signOut() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/sign-in");
}
