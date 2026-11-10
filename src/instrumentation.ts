// Runs once when the server starts. See src/platform/startup.ts.
export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { requireSessionSecretOrExit } = await import("./platform/startup");
    requireSessionSecretOrExit();
  }
}
