"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { secureAction, type ActionResult } from "@/platform/rbac/guards";
import { REJECTION_REASON_CODES } from "./constants";
import { approveCase, claimCase, decideHighRiskApproval, escalateCase, rejectCase, revealCaseField, type RevealTarget } from "./service";

// Server actions never return case records, so raw PII never reaches the browser outside the reveal flow.

const caseId = z.string().regex(/^KYC-\d+$/, "Invalid case ID.");
const caseRecord = (input: { caseId: string }) => ({ type: "kyc_case", id: input.caseId });
const note = z.string().trim().max(2000);
const requiredNote = note.min(1, "A note is required.");
const reasonCode = z.enum(REJECTION_REASON_CODES, { message: "Choose a reason code." });

function refresh(id: string) {
  revalidatePath("/kyc");
  revalidatePath(`/kyc/cases/${id}`);
  revalidatePath("/approvals");
}

export const claimCaseAction = secureAction(
  { permission: "kyc:claim", schema: z.object({ caseId }), record: caseRecord },
  async (user, input) => {
    await claimCase(user, input.caseId);
    refresh(input.caseId);
  },
);

const decisionSchema = z.discriminatedUnion("decision", [
  z.object({ caseId, decision: z.literal("approve"), note: note.optional() }),
  z.object({ caseId, decision: z.literal("reject"), reasonCode, note: requiredNote }),
  z.object({ caseId, decision: z.literal("escalate"), note: requiredNote }),
]);

export const decideCaseAction = secureAction(
  { permission: "kyc:decide", schema: decisionSchema, record: caseRecord },
  async (user, input) => {
    if (input.decision === "approve") await approveCase(user, input.caseId, input.note);
    else if (input.decision === "reject") await rejectCase(user, input.caseId, input.reasonCode, input.note);
    else await escalateCase(user, input.caseId, input.note);
    refresh(input.caseId);
  },
);

const approvalSchema = z.discriminatedUnion("decision", [
  z.object({ caseId, decision: z.literal("approve"), note: note.optional() }),
  z.object({ caseId, decision: z.literal("reject"), reasonCode, note: requiredNote }),
]);

/** The second-approval action on a High case. Requires kyc:approve_high_risk and a different person from the first approver. */
export const decideApprovalAction = secureAction(
  { permission: "kyc:approve_high_risk", schema: approvalSchema, record: caseRecord },
  async (user, input) => {
    await decideHighRiskApproval(user, input.caseId, input.decision, {
      note: input.note,
      reasonCode: input.decision === "reject" ? input.reasonCode : undefined,
    });
    refresh(input.caseId);
  },
);

const revealSchema = z.discriminatedUnion("field", [
  z.object({ caseId, field: z.enum(["ssn", "dateOfBirth", "address"]), reason: requiredNote }),
  z.object({ caseId, field: z.literal("documentNumber"), documentId: z.string().min(1), reason: requiredNote }),
]);

export const revealPiiAction = secureAction(
  { permission: "kyc:reveal_pii", schema: revealSchema, record: caseRecord },
  async (user, { reason, ...target }) => revealCaseField(user, target, reason),
);

/** Bound per field on the case page: `revealCasePii.bind(null, target)`. */
export async function revealCasePii(target: RevealTarget, reason: string): Promise<ActionResult<string>> {
  return revealPiiAction({ ...target, reason });
}

export type DecisionMode = "case" | "second_approval";

/** Bound per case on the case page: `decideCase.bind(null, caseId, mode)`. */
export async function decideCase(
  id: string,
  mode: DecisionMode,
  decision: string,
  values: { note: string; reasonCode?: string },
): Promise<ActionResult<void>> {
  const input = { caseId: id, decision, note: values.note, reasonCode: values.reasonCode } as z.input<typeof decisionSchema>;
  if (mode === "second_approval") return decideApprovalAction(input as z.input<typeof approvalSchema>);
  return decideCaseAction(input);
}
