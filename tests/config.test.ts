import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "@/instrumentation";
import { createSessionToken } from "@/platform/auth/session-token";
import { DEMO_SESSION_SECRET, sessionSecret } from "@/platform/config";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("session secret", () => {
  it("uses the demo default in development and tests when SESSION_SECRET is not set", () => {
    vi.stubEnv("SESSION_SECRET", "");
    for (const env of ["development", "test"]) {
      vi.stubEnv("NODE_ENV", env);
      expect(sessionSecret()).toBe(DEMO_SESSION_SECRET);
    }
  });

  it("throws in production when SESSION_SECRET is not set", () => {
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => sessionSecret()).toThrow("SESSION_SECRET must be set in production.");
    expect(() => createSessionToken("u-ana")).toThrow("SESSION_SECRET must be set in production.");
  });

  it("uses SESSION_SECRET when it is set, in any environment", () => {
    vi.stubEnv("SESSION_SECRET", "a-real-secret");
    for (const env of ["development", "test", "production"]) {
      vi.stubEnv("NODE_ENV", env);
      expect(sessionSecret()).toBe("a-real-secret");
    }
  });

  it("stops the production server from starting without SESSION_SECRET, but not the build", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    await register();
    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledWith("SESSION_SECRET must be set in production.");

    exit.mockClear();
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    await register();
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("SESSION_SECRET", "a-real-secret");
    await register();
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    await register();
    expect(exit).not.toHaveBeenCalled();
  });
});
