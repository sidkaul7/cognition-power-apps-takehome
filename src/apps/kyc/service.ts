import type { KycCase } from "@prisma/client";
import { decideApproval, findPendingApproval, requestApproval } from "@/platform/approvals";
import { recordAudit } from "@/platform/audit";
import { prisma, type Tx } from "@/platform/db";
import { NotFoundError, RuleError } from "@/platform/errors";
import { revealPii, type PiiField } from "@/platform/pii";
import { requirePermission, type Actor } from "@/platform/rbac/can";
import { CASE_RECORD_TYPE, KYC_APP_ID, REJECTION_REASON_LABELS, type CaseStatus, type RejectionReasonCode } from "./constants";
import { allowedDecisions, canClaim, type CaseDecision } from "./rules";

// Business logic for KYC cases. Every write checks permissions and rules, then changes the case
// and writes its audit events in one transaction. Server actions in ./actions.ts call these.

async function loadCase(tx: Tx, caseId: string): Promise<KycCase> {
  const kase = await tx.kycCase.findUnique({ where: { id: caseId } });
  if (!kase) throw new NotFoundError(`Case ${caseId} not found.`);
  return kase;
}

function snapshot(kase: Pick<KycCase, "status" | "assigneeId">) {
  return { status: kase.status, assigneeId: kase.assigneeId };
}

/** Updates the case only if its status has not changed since it was read. */
async function transition(tx: Tx, kase: KycCase, data: { status: CaseStatus } & Partial<Pick<KycCase, "assigneeId" | "decisionNote" | "rejectionReasonCode">>) {
  const result = await tx.kycCase.updateMany({ where: { id: kase.id, status: kase.status }, data });
  if (result.count !== 1) throw new RuleError("The case changed while you were working on it. Reload and try again.");
  return { ...kase, ...data };
}

async function assertDecisionAllowed(tx: Tx, user: Actor, kase: KycCase, decision: CaseDecision) {
  const pending = await findPendingApproval(tx, CASE_RECORD_TYPE, kase.id);
  if (!allowedDecisions(user, kase, pending).includes(decision)) {
    throw new RuleError(`You cannot ${decision} this case while it is ${kase.status.replaceAll("_", " ")}.`);
  }
  return pending;
}

export async function claimCase(user: Actor, caseId: string) {
  requirePermission(user, "kyc:claim");
  return prisma.$transaction(async (tx) => {
    const kase = await loadCase(tx, caseId);
    if (!canClaim(user, kase)) throw new RuleError("Only unassigned New cases can be claimed. Claimed cases can't be released or reassigned.");
    const updated = await transition(tx, kase, { status: "in_review", assigneeId: user.id });
    await recordAudit(tx, { actor: user, action: "case.claim", recordType: CASE_RECORD_TYPE, recordId: kase.id, before: snapshot(kase), after: snapshot(updated) });
    return updated;
  });
}

export async function approveCase(user: Actor, caseId: string, note?: string) {
  requirePermission(user, "kyc:decide");
  const trimmed = note?.trim() || null;
  return prisma.$transaction(async (tx) => {
    const kase = await loadCase(tx, caseId);
    if (kase.status === "pending_second_approval") return secondApproval(tx, user, kase, "approve", { note: trimmed });
    await assertDecisionAllowed(tx, user, kase, "approve");

    // A High case approved by the analyst needs a second approval; everything else, and escalated decisions, are final.
    const needsSecond = kase.status === "in_review" && kase.riskLevel === "high";
    const status: CaseStatus = needsSecond ? "pending_second_approval" : "approved";
    const updated = await transition(tx, kase, { status, decisionNote: trimmed });
    await recordAudit(tx, {
      actor: user,
      action: "case.approve",
      recordType: CASE_RECORD_TYPE,
      recordId: kase.id,
      before: snapshot(kase),
      after: { ...snapshot(updated), stage: needsSecond ? "first_approval" : "final" },
      reason: trimmed,
    });
    if (needsSecond) {
      await requestApproval(tx, {
        requester: user,
        appId: KYC_APP_ID,
        recordType: CASE_RECORD_TYPE,
        recordId: kase.id,
        summary: `Second approval for High-risk case ${kase.id} (${kase.customerName})`,
        requiredPermission: "kyc:approve_high_risk",
      });
    }
    return updated;
  });
}

export async function rejectCase(user: Actor, caseId: string, reasonCode: RejectionReasonCode, note: string) {
  requirePermission(user, "kyc:decide");
  const trimmed = note.trim();
  if (!trimmed) throw new RuleError("Rejecting requires a note.");
  return prisma.$transaction(async (tx) => {
    const kase = await loadCase(tx, caseId);
    if (kase.status === "pending_second_approval") return secondApproval(tx, user, kase, "reject", { note: trimmed, reasonCode });
    await assertDecisionAllowed(tx, user, kase, "reject");
    const updated = await transition(tx, kase, { status: "rejected", decisionNote: trimmed, rejectionReasonCode: reasonCode });
    await recordAudit(tx, {
      actor: user,
      action: "case.reject",
      recordType: CASE_RECORD_TYPE,
      recordId: kase.id,
      before: snapshot(kase),
      after: { ...snapshot(updated), rejectionReasonCode: reasonCode },
      reason: `${REJECTION_REASON_LABELS[reasonCode]}: ${trimmed}`,
    });
    return updated;
  });
}

export async function escalateCase(user: Actor, caseId: string, note: string) {
  requirePermission(user, "kyc:decide");
  const trimmed = note.trim();
  if (!trimmed) throw new RuleError("Escalating requires a note.");
  return prisma.$transaction(async (tx) => {
    const kase = await loadCase(tx, caseId);
    await assertDecisionAllowed(tx, user, kase, "escalate");
    const updated = await transition(tx, kase, { status: "escalated", decisionNote: trimmed });
    await recordAudit(tx, { actor: user, action: "case.escalate", recordType: CASE_RECORD_TYPE, recordId: kase.id, before: snapshot(kase), after: snapshot(updated), reason: trimmed });
    return updated;
  });
}

/** The second-approval decision on a High case. Also the target of the direct "approval action". */
export async function decideHighRiskApproval(
  user: Actor,
  caseId: string,
  decision: "approve" | "reject",
  input: { note?: string; reasonCode?: RejectionReasonCode },
) {
  requirePermission(user, "kyc:approve_high_risk");
  return prisma.$transaction(async (tx) => {
    const kase = await loadCase(tx, caseId);
    return secondApproval(tx, user, kase, decision, { note: input.note?.trim() || null, reasonCode: input.reasonCode });
  });
}

async function secondApproval(
  tx: Tx,
  user: Actor,
  kase: KycCase,
  decision: "approve" | "reject",
  input: { note: string | null; reasonCode?: RejectionReasonCode },
) {
  if (kase.status !== "pending_second_approval") throw new RuleError("This case is not waiting for a second approval.");
  const pending = await findPendingApproval(tx, CASE_RECORD_TYPE, kase.id);
  if (!pending) throw new RuleError("No pending approval found for this case.");
  if (decision === "reject" && (!input.reasonCode || !input.note)) throw new RuleError("Rejecting requires a reason code and a note.");

  const reason = decision === "reject" && input.reasonCode ? `${REJECTION_REASON_LABELS[input.reasonCode]}: ${input.note}` : input.note;
  // Enforces the required permission and the two-person rule.
  await decideApproval(tx, { approvalId: pending.id, decider: user, decision, reason });

  const updated =
    decision === "approve"
      ? await transition(tx, kase, { status: "approved" })
      : await transition(tx, kase, { status: "rejected", decisionNote: input.note, rejectionReasonCode: input.reasonCode ?? null });
  await recordAudit(tx, {
    actor: user,
    action: decision === "approve" ? "case.approve" : "case.reject",
    recordType: CASE_RECORD_TYPE,
    recordId: kase.id,
    before: snapshot(kase),
    after: { ...snapshot(updated), stage: "second_approval", ...(input.reasonCode ? { rejectionReasonCode: input.reasonCode } : {}) },
    reason,
  });
  return updated;
}

export type RevealTarget = { caseId: string; field: Exclude<PiiField, "documentNumber"> } | { caseId: string; field: "documentNumber"; documentId: string };

/** Returns one raw PII value for one field, and logs the reveal. */
export async function revealCaseField(user: Actor, target: RevealTarget, reason: string): Promise<string> {
  requirePermission(user, "kyc:reveal_pii");
  return prisma.$transaction(async (tx) => {
    const kase = await loadCase(tx, target.caseId);
    if (target.field === "documentNumber") {
      const doc = await tx.kycDocument.findFirst({ where: { id: target.documentId, caseId: kase.id } });
      if (!doc) throw new NotFoundError("Document not found.");
      return revealPii(tx, { actor: user, field: "documentNumber", value: doc.documentNumber, recordType: CASE_RECORD_TYPE, recordId: kase.id, reason, detail: { documentId: doc.id } });
    }
    return revealPii(tx, { actor: user, field: target.field, value: kase[target.field], recordType: CASE_RECORD_TYPE, recordId: kase.id, reason });
  });
}
