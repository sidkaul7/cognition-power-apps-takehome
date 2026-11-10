import { sessionSecret } from "./config";

/** In production, exits if SESSION_SECRET is missing, instead of serving errors or signing cookies with the demo secret. */
export function requireSessionSecretOrExit() {
  try {
    sessionSecret();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
