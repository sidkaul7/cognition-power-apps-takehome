// Development defaults so the app runs with no .env file.
// The default session secret is for development and tests only.
export const DEFAULT_DATABASE_URL = "file:./dev.db";
export const DEMO_SESSION_SECRET = "demo-only-session-secret-do-not-use-in-production";

export function databaseUrl(): string {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

/** Falls back to the demo secret in development and tests, and refuses to run without one in production. */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production.");
  return DEMO_SESSION_SECRET;
}
