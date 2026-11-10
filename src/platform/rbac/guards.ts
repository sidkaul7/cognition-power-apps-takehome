import "server-only";
import { forbidden, redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "../audit";
import { getCurrentUser, type CurrentUser } from "../auth";
import { prisma } from "../db";
import { AppError, ForbiddenError, UnauthenticatedError, ValidationError } from "../errors";
import { can, type Actor } from "./can";
import type { Permission } from "./permissions";

export type RecordRef = { type: string; id: string };

/** Writes an `auth.denied` event. Record fields stay empty when there is no record. */
export async function recordDenial(user: Actor | null, permission: Permission | string, record?: RecordRef | null) {
  await prisma.$transaction((tx) =>
    recordAudit(tx, {
      actor: user,
      action: "auth.denied",
      recordType: record?.type ?? null,
      recordId: record?.id ?? null,
      after: { permission },
    }),
  );
}

/** Pages: redirects to sign-in without a session; renders the 403 page and audits the denial without the permission. */
export async function requirePagePermission(permission: Permission, record?: RecordRef): Promise<CurrentUser> {
  const user = await requireSignedIn();
  if (!can(user, permission)) {
    await recordDenial(user, permission, record);
    forbidden();
  }
  return user;
}

/** Pages that any signed-in user may open, such as the home page and "My approvals". */
export async function requireSignedIn(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; status: number; error: string };

type SecureActionOptions<S extends z.ZodType> = {
  permission: Permission;
  schema: S;
  /** The record the action targets, used in the `auth.denied` event. */
  record?: (input: z.infer<S>) => RecordRef | null;
};

/**
 * The one wrapper for server actions: authenticates, validates input with Zod, checks the
 * permission on the server, and turns errors into a typed result the UI shows as a message.
 * A denial returns status 403 and writes an `auth.denied` event.
 */
export function secureAction<S extends z.ZodType, T>(
  options: SecureActionOptions<S>,
  handler: (user: CurrentUser, input: z.infer<S>) => Promise<T>,
): (raw: z.input<S>) => Promise<ActionResult<T>> {
  return async (raw) => {
    const user = await getCurrentUser();
    if (!user) return fail(new UnauthenticatedError());

    const parsed = options.schema.safeParse(raw);
    const record = parsed.success ? (options.record?.(parsed.data) ?? null) : null;

    if (!can(user, options.permission)) {
      await recordDenial(user, options.permission, record);
      return fail(new ForbiddenError());
    }
    if (!parsed.success) {
      return fail(new ValidationError(parsed.error.issues.map((issue) => issue.message).join("; ")));
    }
    try {
      return { ok: true, data: await handler(user, parsed.data) };
    } catch (error) {
      if (error instanceof ForbiddenError) await recordDenial(user, options.permission, record);
      if (error instanceof AppError) return fail(error);
      throw error;
    }
  };
}

function fail(error: AppError): ActionResult<never> {
  return { ok: false, status: error.status, error: `${error.status}: ${error.message}` };
}
