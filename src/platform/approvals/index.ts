import type { Approval } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { recordAudit } from "../audit";
import { ForbiddenError, NotFoundError, RuleError } from "../errors";
import { can, type Actor } from "../rbac/can";
import { PERMISSIONS, type Permission } from "../rbac/permissions";
import { maskSsnsInText } from "../pii/mask";

export type ApprovalStatus = "pending" | "approved" | "rejected";

type RequestInput = {
  requester: Actor;
  appId: string;
  recordType: string;
  recordId: string;
  summary: string;
  requiredPermission: Permission;
};

/** Opens a pending approval and writes `approval.request` in the caller's transaction. */
export async function requestApproval(tx: Tx, input: RequestInput): Promise<Approval> {
  const existing = await tx.approval.findFirst({
    where: { recordType: input.recordType, recordId: input.recordId, status: "pending" },
  });
  if (existing) throw new RuleError("This record already has a pending approval.");
  const approval = await tx.approval.create({
    data: {
      appId: input.appId,
      recordType: input.recordType,
      recordId: input.recordId,
      summary: input.summary,
      requiredPermission: input.requiredPermission,
      requestedById: input.requester.id,
      requestedByName: input.requester.name,
    },
  });
  await recordAudit(tx, {
    actor: input.requester,
    action: "approval.request",
    recordType: input.recordType,
    recordId: input.recordId,
    after: { approvalId: approval.id, status: "pending", requiredPermission: input.requiredPermission },
  });
  return approval;
}

type DecideInput = {
  approvalId: string;
  decider: Actor;
  decision: "approve" | "reject";
  reason?: string | null;
};

/**
 * Approves or rejects a pending approval. Enforces the required permission, the two-person rule
 * (the requester cannot decide their own request), and a reason on rejection.
 */
export async function decideApproval(tx: Tx, input: DecideInput): Promise<Approval> {
  const approval = await tx.approval.findUnique({ where: { id: input.approvalId } });
  if (!approval) throw new NotFoundError("Approval not found.");
  if (approval.status !== "pending") throw new RuleError("This approval has already been decided.");

  const permission = approval.requiredPermission as Permission;
  if (!PERMISSIONS.includes(permission) || !can(input.decider, permission)) {
    throw new ForbiddenError(`Approving requires ${approval.requiredPermission}.`);
  }
  if (approval.requestedById === input.decider.id) {
    throw new RuleError("Two-person rule: the person who requested an approval cannot decide it.");
  }
  const trimmed = input.reason?.trim();
  const reason = trimmed ? maskSsnsInText(trimmed) : null;
  if (input.decision === "reject" && !reason) throw new RuleError("A rejection requires a reason.");

  const status: ApprovalStatus = input.decision === "approve" ? "approved" : "rejected";
  const updated = await tx.approval.update({
    where: { id: approval.id },
    data: { status, decidedById: input.decider.id, decidedByName: input.decider.name, reason, decidedAt: new Date() },
  });
  await recordAudit(tx, {
    actor: input.decider,
    action: input.decision === "approve" ? "approval.approve" : "approval.reject",
    recordType: approval.recordType,
    recordId: approval.recordId,
    before: { approvalId: approval.id, status: approval.status },
    after: { approvalId: approval.id, status },
    reason,
  });
  return updated;
}

/** Pending approvals the user can act on: they hold the permission and did not make the request. */
export async function listActionableApprovals(user: Actor): Promise<Approval[]> {
  const pending = await prisma.approval.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" } });
  return pending.filter(
    (approval) =>
      approval.requestedById !== user.id &&
      PERMISSIONS.includes(approval.requiredPermission as Permission) &&
      can(user, approval.requiredPermission as Permission),
  );
}

export async function findPendingApproval(db: Pick<Tx, "approval">, recordType: string, recordId: string) {
  return db.approval.findFirst({ where: { recordType, recordId, status: "pending" } });
}
