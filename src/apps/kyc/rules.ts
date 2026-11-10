import { can, type Actor } from "@/platform/rbac/can";

export type CaseDecision = "approve" | "reject" | "escalate";

export type CaseForRules = { status: string; assigneeId: string | null };
export type PendingApprovalForRules = { requestedById: string } | null;

export function canClaim(user: Actor, kase: CaseForRules): boolean {
  return can(user, "kyc:claim") && kase.status === "new" && kase.assigneeId === null;
}

/**
 * The decisions the rules allow this user on this case. The UI shows exactly these,
 * and the server re-checks them on every write.
 */
export function allowedDecisions(user: Actor, kase: CaseForRules, pendingApproval: PendingApprovalForRules): CaseDecision[] {
  if (!can(user, "kyc:decide")) return [];
  switch (kase.status) {
    case "in_review":
      // Analysts decide only the cases they have claimed.
      return kase.assigneeId === user.id ? ["approve", "reject", "escalate"] : [];
    case "escalated":
      // Compliance Leads decide escalated cases without claiming them; the decision is final.
      return can(user, "kyc:approve_high_risk") ? ["approve", "reject"] : [];
    case "pending_second_approval":
      // Second approval: a different person with kyc:approve_high_risk. Never escalated.
      return can(user, "kyc:approve_high_risk") && pendingApproval !== null && pendingApproval.requestedById !== user.id
        ? ["approve", "reject"]
        : [];
    default:
      return [];
  }
}
