"use client";

import { DecisionPanel, type DecisionOption } from "@/platform/components/decision-panel";
import { REJECTION_REASON_CODES, REJECTION_REASON_LABELS } from "../constants";
import { decideCase, type DecisionMode } from "../actions";
import type { CaseDecision } from "../rules";

const reasonCodes = REJECTION_REASON_CODES.map((value) => ({ value, label: REJECTION_REASON_LABELS[value] }));

function optionFor(decision: CaseDecision, mode: DecisionMode, isHighFirstApproval: boolean): DecisionOption {
  switch (decision) {
    case "approve":
      return {
        id: "approve",
        label: mode === "second_approval" ? "Approve (second approval)" : "Approve",
        dialogTitle: mode === "second_approval" ? "Give the second approval" : "Approve case",
        dialogDescription: isHighFirstApproval
          ? "This is a High-risk case. Approving sends it to a Compliance Lead for a second approval."
          : mode === "second_approval"
            ? "Approving moves the case to Approved."
            : "Approving moves the case to Approved. This decision is final.",
        noteLabel: "Note",
        noteRequired: false,
      };
    case "reject":
      return {
        id: "reject",
        label: "Reject",
        variant: "destructive",
        dialogTitle: "Reject case",
        dialogDescription: "Rejecting is final and never needs a second approval.",
        noteLabel: "Note",
        noteRequired: true,
        reasonCodes,
      };
    case "escalate":
      return {
        id: "escalate",
        label: "Escalate",
        variant: "outline",
        dialogTitle: "Escalate to a Compliance Lead",
        dialogDescription: "The case moves to Escalated and appears in the Compliance Lead's queue.",
        noteLabel: "Note",
        noteRequired: true,
      };
  }
}

type Props = {
  caseId: string;
  mode: DecisionMode;
  decisions: CaseDecision[];
  isHighFirstApproval: boolean;
  emptyMessage: string;
  description?: string;
};

export function CaseDecisionPanel({ caseId, mode, decisions, isHighFirstApproval, emptyMessage, description }: Props) {
  return (
    <DecisionPanel
      title={mode === "second_approval" ? "Second approval" : "Decision"}
      description={description}
      options={decisions.map((decision) => optionFor(decision, mode, isHighFirstApproval))}
      emptyMessage={emptyMessage}
      onDecide={(optionId, values) => decideCase(caseId, mode, optionId, values)}
    />
  );
}
