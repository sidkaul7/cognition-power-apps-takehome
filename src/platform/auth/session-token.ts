import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "../config";

export const SESSION_COOKIE = "itp_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type SessionPayload = { userId: string; issuedAt: number };

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createSessionToken(userId: string, now = Date.now(), secret = sessionSecret()): string {
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: now } satisfies SessionPayload)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the user ID when the signature is valid and the session has not expired. */
export function readSessionToken(token: string | undefined, now = Date.now(), secret = sessionSecret()): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    if (typeof parsed.userId !== "string" || typeof parsed.issuedAt !== "number") return null;
    if (now - parsed.issuedAt > SESSION_MAX_AGE_SECONDS * 1000) return null;
    return parsed.userId;
  } catch {
    return null;
  }
}
