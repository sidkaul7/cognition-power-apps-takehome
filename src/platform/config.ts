// Development defaults so the app runs with no .env file.
// The default session secret is for the demo only.
export const DEFAULT_DATABASE_URL = "file:./dev.db";
export const DEMO_SESSION_SECRET = "demo-only-session-secret-do-not-use-in-production";

export function databaseUrl(): string {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

export function sessionSecret(): string {
  return process.env.SESSION_SECRET || DEMO_SESSION_SECRET;
}
