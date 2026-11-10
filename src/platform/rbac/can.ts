import { ForbiddenError } from "../errors";
import { ROLE_PERMISSIONS, isRole, type Permission } from "./permissions";

export type Actor = { id: string; name: string; role: string };

export function can(user: Actor | null | undefined, permission: Permission): boolean {
  if (!user || !isRole(user.role)) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

/** Throws ForbiddenError when the user lacks the permission. Pure check, no audit; use the guards in ./guards for that. */
export function requirePermission(user: Actor | null | undefined, permission: Permission): asserts user is Actor {
  if (!can(user, permission)) throw new ForbiddenError(`Missing permission ${permission}.`);
}
