import { beforeAll, describe, expect, it } from "vitest";
import { buildSeedCases } from "../prisma/seed-data";
import { listQueue, QUEUE_SORT_KEYS } from "@/apps/kyc/queries";
import { allowedDecisions, canClaim } from "@/apps/kyc/rules";
import { approveCase, claimCase, decideHighRiskApproval, escalateCase, rejectCase } from "@/apps/kyc/service";
import { listActionableApprovals } from "@/platform/approvals";
import { parseTableParams } from "@/platform/components/data-table/params";
import { prisma } from "@/platform/db";
import { ForbiddenError, RuleError } from "@/platform/errors";
import { ana, eventsFor, marcus, priya, sam, seedDatabase } from "./helpers";

// Seed layout: KYC-1001..1028 are New and unassigned; risk cycles High, Medium, Low.
// KYC-1029..1034 are In review (Ana), KYC-1035..1037 Escalated, KYC-1038..1039 Approved, KYC-1040 Rejected.

const queueParams = (query: Record<string, string>) =>
  parseTableParams(query, { sortKeys: QUEUE_SORT_KEYS, defaultSort: "sla", filterKeys: ["status", "risk", "assignee"] });
const status = async (id: string) => (await prisma.kycCase.findUniqueOrThrow({ where: { id } })).status;

beforeAll(seedDatabase);

describe("seed", () => {
  it("has 40 cases with mixed risk, about a third with hits, 5+ unassigned High, and breached SLAs", async () => {
    const cases = buildSeedCases();
    expect(cases).toHaveLength(40);
    expect(new Set(cases.map((c) => c.riskLevel))).toEqual(new Set(["low", "medium", "high"]));
    const withHits = cases.filter((c) => c.hits.length > 0).length;
    expect(withHits).toBeGreaterThanOrEqual(10);
    expect(withHits).toBeLessThanOrEqual(17);
    expect(cases.filter((c) => c.riskLevel === "high" && c.status === "new" && !c.assigneeId).length).toBeGreaterThanOrEqual(5);
    const breached = await prisma.kycCase.count({ where: { slaDueAt: { lt: new Date() }, status: { in: ["new", "in_review", "escalated"] } } });
    expect(breached).toBeGreaterThanOrEqual(3);
  });
});

describe("queue", () => {
  it("filters by status, risk, and assignee, searches case-insensitively, and sorts by SLA", async () => {
    const { rows, total } = await listQueue(ana, queueParams({ status: "new", risk: "high", assignee: "unassigned" }));
    expect(total).toBeGreaterThanOrEqual(5);
    expect(rows.every((r) => r.status === "new" && r.riskLevel === "high" && r.assigneeId === null)).toBe(true);
    const due = rows.map((r) => r.slaDueAt.getTime());
    expect(due).toEqual([...due].sort((a, b) => a - b));

    const name = buildSeedCases()[5].customerName;
    expect((await listQueue(ana, queueParams({ q: name.toUpperCase() }))).rows.map((r) => r.customerName)).toContain(name);
    expect((await listQueue(ana, queueParams({ q: "kyc-1010" }))).rows.map((r) => r.id)).toEqual(["KYC-1010"]);
    expect((await listQueue(ana, queueParams({ assignee: "me" }))).rows.every((r) => r.assigneeId === ana.id)).toBe(true);
  });

  it("pages 20 rows at a time", async () => {
    expect((await listQueue(ana, queueParams({}))).rows).toHaveLength(20);
    expect((await listQueue(ana, queueParams({ page: "2" }))).rows).toHaveLength(20);
  });
});

describe("claiming", () => {
  it("moves New to In review and assigns the analyst", async () => {
    await claimCase(ana, "KYC-1003");
    expect(await prisma.kycCase.findUniqueOrThrow({ where: { id: "KYC-1003" } })).toMatchObject({ status: "in_review", assigneeId: ana.id });
    expect((await eventsFor("KYC-1003")).map((e) => e.action)).toEqual(["case.create", "case.claim"]);
  });

  it("cannot claim a claimed case, and only analysts can claim", async () => {
    await expect(claimCase(ana, "KYC-1003")).rejects.toThrow(RuleError);
    for (const user of [marcus, priya, sam]) await expect(claimCase(user, "KYC-1006")).rejects.toThrow(ForbiddenError);
    expect(canClaim(sam, { status: "new", assigneeId: null })).toBe(false);
  });
});

describe("decisions", () => {
  it("approving a Low or Medium case is final", async () => {
    await claimCase(ana, "KYC-1002");
    await approveCase(ana, "KYC-1002");
    expect(await status("KYC-1002")).toBe("approved");
  });

  it("only the assigned analyst decides an In review case", async () => {
    await claimCase(ana, "KYC-1005");
    const secondAnalyst = { id: "u-other", name: "Other Analyst", role: "kyc_analyst" };
    expect(allowedDecisions(secondAnalyst, { status: "in_review", assigneeId: ana.id }, null)).toEqual([]);
    await expect(approveCase(secondAnalyst, "KYC-1005")).rejects.toThrow(RuleError);
    await expect(approveCase(ana, "KYC-1006")).rejects.toThrow(RuleError);
  });

  it("rejecting requires a reason code and note, and stores both", async () => {
    await expect(rejectCase(ana, "KYC-1005", "document_mismatch", " ")).rejects.toThrow(RuleError);
    await rejectCase(ana, "KYC-1005", "document_mismatch", "Name differs");
    expect(await prisma.kycCase.findUniqueOrThrow({ where: { id: "KYC-1005" } })).toMatchObject({
      status: "rejected",
      rejectionReasonCode: "document_mismatch",
      decisionNote: "Name differs",
    });
  });

  it("decided cases cannot change again", async () => {
    await expect(approveCase(ana, "KYC-1005")).rejects.toThrow(RuleError);
    await expect(escalateCase(ana, "KYC-1005", "late")).rejects.toThrow(RuleError);
  });

  it("Platform Admin and Support Agent cannot decide anything", async () => {
    expect(allowedDecisions(sam, { status: "in_review", assigneeId: sam.id }, null)).toEqual([]);
    await expect(approveCase(sam, "KYC-1031")).rejects.toThrow(ForbiddenError);
    await expect(approveCase(priya, "KYC-1031")).rejects.toThrow(ForbiddenError);
  });
});

describe("High risk and two-person approval", () => {
  it("first approval of a High case moves it to Pending second approval and asks for approval", async () => {
    await claimCase(ana, "KYC-1001");
    await approveCase(ana, "KYC-1001");
    expect(await status("KYC-1001")).toBe("pending_second_approval");
    expect((await listActionableApprovals(marcus)).map((a) => a.recordId)).toContain("KYC-1001");
    expect(await listActionableApprovals(ana)).toEqual([]);
  });

  it("the first approver cannot give the second approval, through any path", async () => {
    expect(allowedDecisions(ana, { status: "pending_second_approval", assigneeId: ana.id }, { requestedById: ana.id })).toEqual([]);
    await expect(approveCase(ana, "KYC-1001")).rejects.toThrow();
    await expect(decideHighRiskApproval(ana, "KYC-1001", "approve", {})).rejects.toThrow(ForbiddenError);
    expect(await status("KYC-1001")).toBe("pending_second_approval");
  });

  it("a pending case cannot be escalated", async () => {
    await expect(escalateCase(marcus, "KYC-1001", "escalate")).rejects.toThrow(RuleError);
  });

  it("a Compliance Lead approves it and history shows both decisions", async () => {
    await decideHighRiskApproval(marcus, "KYC-1001", "approve", {});
    expect(await status("KYC-1001")).toBe("approved");
    const events = await eventsFor("KYC-1001");
    expect(events.filter((e) => e.action === "case.approve").map((e) => e.actorId)).toEqual([ana.id, marcus.id]);
    expect(events.map((e) => e.action)).toContain("approval.approve");
  });

  it("a Compliance Lead can reject a pending case with a reason code and note", async () => {
    await claimCase(ana, "KYC-1004");
    await approveCase(ana, "KYC-1004");
    await expect(decideHighRiskApproval(marcus, "KYC-1004", "reject", { note: "No code" })).rejects.toThrow(RuleError);
    await rejectCase(marcus, "KYC-1004", "sanctions_match", "Confirmed sanctions hit");
    expect(await prisma.kycCase.findUniqueOrThrow({ where: { id: "KYC-1004" } })).toMatchObject({ status: "rejected", rejectionReasonCode: "sanctions_match" });
    expect(await prisma.approval.findFirstOrThrow({ where: { recordId: "KYC-1004" } })).toMatchObject({ status: "rejected", decidedById: marcus.id });
  });
});

describe("escalation", () => {
  it("requires a note, moves the case to Escalated, and shows it in the lead's default queue", async () => {
    await claimCase(ana, "KYC-1007");
    await expect(escalateCase(ana, "KYC-1007", "")).rejects.toThrow(RuleError);
    await escalateCase(ana, "KYC-1007", "Possible sanctions match");
    expect(await status("KYC-1007")).toBe("escalated");
    expect((await listQueue(marcus, queueParams({ status: "escalated" }))).rows.map((r) => r.id)).toContain("KYC-1007");
  });

  it("only a Compliance Lead decides an escalated case, without claiming, and the decision is final even for High risk", async () => {
    expect(allowedDecisions(ana, { status: "escalated", assigneeId: ana.id }, null)).toEqual([]);
    await expect(approveCase(ana, "KYC-1007")).rejects.toThrow(RuleError);
    await approveCase(marcus, "KYC-1007");
    expect(await status("KYC-1007")).toBe("approved");
    expect(await prisma.approval.count({ where: { recordId: "KYC-1007" } })).toBe(0);
  });
});

describe("decision notes", () => {
  it("saves the second approver's note as the case's decision note", async () => {
    await claimCase(ana, "KYC-1013");
    await approveCase(ana, "KYC-1013", "Hits are false positives");
    await approveCase(marcus, "KYC-1013", "Confirmed the hits are false positives");
    expect(await prisma.kycCase.findUniqueOrThrow({ where: { id: "KYC-1013" } })).toMatchObject({
      status: "approved",
      decisionNote: "Confirmed the hits are false positives",
    });
  });

  it("keeps the analyst's decision note when the second approver leaves the note blank", async () => {
    await claimCase(ana, "KYC-1019");
    await approveCase(ana, "KYC-1019", "Documents verified");
    await approveCase(marcus, "KYC-1019", "   ");
    expect(await prisma.kycCase.findUniqueOrThrow({ where: { id: "KYC-1019" } })).toMatchObject({
      status: "approved",
      decisionNote: "Documents verified",
    });
  });

  it("masks SSN-shaped text in notes before storing them on the case and in the audit log", async () => {
    await claimCase(ana, "KYC-1016");
    await escalateCase(ana, "KYC-1016", "Customer gave SSN 123-45-6789 by phone");
    const kase = await prisma.kycCase.findUniqueOrThrow({ where: { id: "KYC-1016" } });
    expect(kase.decisionNote).toBe("Customer gave SSN ***-**-6789 by phone");
    const escalation = (await eventsFor("KYC-1016")).find((e) => e.action === "case.escalate");
    expect(escalation?.reason).toBe("Customer gave SSN ***-**-6789 by phone");
    expect((await eventsFor("KYC-1016")).map((e) => e.reason ?? "").join(" ")).not.toContain("123-45-6789");
  });
});
