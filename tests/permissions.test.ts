import { beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/platform/db";
import { ForbiddenError } from "@/platform/errors";
import { createSessionToken, readSessionToken } from "@/platform/auth/session-token";
import { can, requirePermission } from "@/platform/rbac/can";
import { PERMISSIONS, ROLE_PERMISSIONS, type Permission, type Role } from "@/platform/rbac/permissions";
import { ana, marcus, priya, sam, seedDatabase } from "./helpers";

const currentUser = vi.hoisted(() => ({ value: null as null | { id: string; name: string; role: string; email: string } }));
vi.mock("@/platform/auth", () => ({ getCurrentUser: async () => currentUser.value }));

// The permission table from docs/PRD.md, row by row.
const PRD_TABLE: Record<Permission, Record<Role, boolean>> = {
  "kyc:view": { kyc_analyst: true, compliance_lead: true, support_agent: false, platform_admin: true },
  "kyc:claim": { kyc_analyst: true, compliance_lead: false, support_agent: false, platform_admin: false },
  "kyc:decide": { kyc_analyst: true, compliance_lead: true, support_agent: false, platform_admin: false },
  "kyc:approve_high_risk": { kyc_analyst: false, compliance_lead: true, support_agent: false, platform_admin: false },
  "kyc:reveal_pii": { kyc_analyst: false, compliance_lead: true, support_agent: false, platform_admin: false },
  "audit:view": { kyc_analyst: false, compliance_lead: true, support_agent: false, platform_admin: true },
  "audit:verify": { kyc_analyst: false, compliance_lead: false, support_agent: false, platform_admin: true },
};

beforeAll(seedDatabase);

describe("permission map", () => {
  it("matches the PRD table for every role and permission", () => {
    expect([...PERMISSIONS].sort()).toEqual(Object.keys(PRD_TABLE).sort());
    for (const permission of PERMISSIONS) {
      for (const role of Object.keys(ROLE_PERMISSIONS) as Role[]) {
        expect(can({ id: "x", name: "x", role }, permission), `${role} ${permission}`).toBe(PRD_TABLE[permission][role]);
      }
    }
  });

  it("denies unknown roles and missing users", () => {
    expect(can({ id: "x", name: "x", role: "superuser" }, "kyc:view")).toBe(false);
    expect(can(null, "kyc:view")).toBe(false);
  });

  it("requirePermission throws ForbiddenError when the permission is missing", () => {
    expect(() => requirePermission(priya, "kyc:view")).toThrow(ForbiddenError);
    expect(() => requirePermission(ana, "kyc:view")).not.toThrow();
  });

  it("gives Priya no KYC tile and Ana, Marcus, and Sam the KYC tile", async () => {
    const { installedToolsFor, plannedTools } = await import("@/apps/registry");
    expect(installedToolsFor(priya).map((t) => t.id)).toEqual([]);
    for (const user of [ana, marcus, sam]) expect(installedToolsFor(user).map((t) => t.id)).toEqual(["kyc"]);
    expect(plannedTools().map((t) => t.id)).toEqual(["refunds", "feature-flags"]);
  });
});

describe("session cookie", () => {
  it("round-trips a signed token and rejects tampering, other secrets, and expiry", () => {
    const token = createSessionToken("u-ana", 1_000, "secret");
    expect(readSessionToken(token, 2_000, "secret")).toBe("u-ana");
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ userId: "u-marcus", issuedAt: 1_000 })).toString("base64url");
    expect(readSessionToken(`${forged}.${signature}`, 2_000, "secret")).toBeNull();
    expect(readSessionToken(`${payload}.${signature}`, 2_000, "other")).toBeNull();
    expect(readSessionToken(token, 1_000 + 9 * 60 * 60 * 1000, "secret")).toBeNull();
    expect(readSessionToken(undefined)).toBeNull();
  });
});

describe("server-side denial", () => {
  it("writes auth.denied with empty record fields when there is no record", async () => {
    const { recordDenial } = await import("@/platform/rbac/guards");
    await recordDenial(priya, "kyc:view");
    const event = await prisma.auditEvent.findFirst({ where: { action: "auth.denied" }, orderBy: { id: "desc" } });
    expect(event).toMatchObject({ actorId: priya.id, recordType: null, recordId: null });
  });

  it("returns 403 from a server action and audits the denial against the record", async () => {
    const { claimCaseAction } = await import("@/apps/kyc/actions");
    currentUser.value = { ...sam, email: "sam.park@example.com" };
    const result = await claimCaseAction({ caseId: "KYC-1001" });
    expect(result).toMatchObject({ ok: false, status: 403 });
    const event = await prisma.auditEvent.findFirst({ where: { action: "auth.denied" }, orderBy: { id: "desc" } });
    expect(event).toMatchObject({ actorId: sam.id, recordType: "kyc_case", recordId: "KYC-1001" });
    const kase = await prisma.kycCase.findUniqueOrThrow({ where: { id: "KYC-1001" } });
    expect(kase.assigneeId).toBeNull();
  });

  it("returns 401 without a session", async () => {
    const { claimCaseAction } = await import("@/apps/kyc/actions");
    currentUser.value = null;
    expect(await claimCaseAction({ caseId: "KYC-1001" })).toMatchObject({ ok: false, status: 401 });
  });
});
