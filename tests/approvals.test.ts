import { beforeAll, describe, expect, it } from "vitest";
import { decideApproval, listActionableApprovals, requestApproval } from "@/platform/approvals";
import { prisma } from "@/platform/db";
import { ForbiddenError, RuleError } from "@/platform/errors";
import { ana, marcus, sam, seedDatabase } from "./helpers";

const secondLead = { id: "u-lead-2", name: "Jordan Vale", role: "compliance_lead" };

beforeAll(async () => {
  await seedDatabase();
  await prisma.user.create({ data: { ...secondLead, email: "jordan.vale@example.com" } });
});

function request(requester: typeof marcus, recordId: string) {
  return prisma.$transaction((tx) =>
    requestApproval(tx, { requester, appId: "test", recordType: "test_record", recordId, summary: "Test", requiredPermission: "kyc:approve_high_risk" }),
  );
}

describe("two-person rule", () => {
  it("rejects a decision from the person who made the request, even with the permission", async () => {
    const approval = await request(marcus, "R-1");
    await expect(prisma.$transaction((tx) => decideApproval(tx, { approvalId: approval.id, decider: marcus, decision: "approve" }))).rejects.toThrow(RuleError);
    expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).status).toBe("pending");
  });

  it("rejects a decision from anyone without the required permission", async () => {
    const approval = await request(marcus, "R-2");
    for (const decider of [ana, sam]) {
      await expect(prisma.$transaction((tx) => decideApproval(tx, { approvalId: approval.id, decider, decision: "approve" }))).rejects.toThrow(ForbiddenError);
    }
  });

  it("lets a different person with the permission approve, and records it", async () => {
    const approval = await request(marcus, "R-3");
    const decided = await prisma.$transaction((tx) => decideApproval(tx, { approvalId: approval.id, decider: secondLead, decision: "approve" }));
    expect(decided).toMatchObject({ status: "approved", decidedById: secondLead.id });
    const actions = (await prisma.auditEvent.findMany({ where: { recordId: "R-3" }, orderBy: { id: "asc" } })).map((e) => e.action);
    expect(actions).toEqual(["approval.request", "approval.approve"]);
  });

  it("requires a reason to reject, and cannot be decided twice", async () => {
    const approval = await request(marcus, "R-4");
    const decide = (reason?: string) => prisma.$transaction((tx) => decideApproval(tx, { approvalId: approval.id, decider: secondLead, decision: "reject", reason }));
    await expect(decide("  ")).rejects.toThrow("reason");
    expect(await decide("Source of funds unclear")).toMatchObject({ status: "rejected", reason: "Source of funds unclear" });
    await expect(decide("again")).rejects.toThrow("already been decided");
  });

  it("lists only pending approvals the user can act on and did not request", async () => {
    await request(marcus, "R-5");
    const forMarcus = (await listActionableApprovals(marcus)).map((a) => a.recordId);
    const forLead2 = (await listActionableApprovals(secondLead)).map((a) => a.recordId);
    expect(forMarcus).not.toContain("R-5");
    expect(forLead2).toContain("R-5");
    expect(await listActionableApprovals(ana)).toEqual([]);
  });
});

describe("approval reasons", () => {
  it("masks SSN-shaped text in the reason on the approval and in its audit event", async () => {
    const approval = await request(marcus, "R-SSN");
    const decided = await prisma.$transaction((tx) =>
      decideApproval(tx, { approvalId: approval.id, decider: secondLead, decision: "reject", reason: "SSN 123-45-6789 does not match" }),
    );
    expect(decided.reason).toBe("SSN ***-**-6789 does not match");
    const event = await prisma.auditEvent.findFirstOrThrow({ where: { recordId: "R-SSN", action: "approval.reject" } });
    expect(event.reason).toBe("SSN ***-**-6789 does not match");
  });
});
