import type { BadgeTone } from "@/platform/components/status-badge";

export const KYC_APP_ID = "kyc";
export const CASE_RECORD_TYPE = "kyc_case";
export const SLA_HOURS = 48;

export const CASE_STATUSES = ["new", "in_review", "pending_second_approval", "approved", "rejected", "escalated"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const STATUS_LABELS: Record<CaseStatus, string> = {
  new: "New",
  in_review: "In review",
  pending_second_approval: "Pending second approval",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
};

export const STATUS_TONES: Record<CaseStatus, BadgeTone> = {
  new: "neutral",
  in_review: "info",
  pending_second_approval: "warning",
  approved: "success",
  rejected: "danger",
  escalated: "warning",
};

export const OPEN_STATUSES: readonly CaseStatus[] = ["new", "in_review", "pending_second_approval", "escalated"];

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_LABELS: Record<RiskLevel, string> = { low: "Low", medium: "Medium", high: "High" };
export const RISK_TONES: Record<RiskLevel, BadgeTone> = { low: "muted", medium: "warning", high: "danger" };

export const REJECTION_REASON_CODES = ["document_mismatch", "sanctions_match", "incomplete", "other"] as const;
export type RejectionReasonCode = (typeof REJECTION_REASON_CODES)[number];

export const REJECTION_REASON_LABELS: Record<RejectionReasonCode, string> = {
  document_mismatch: "Document mismatch",
  sanctions_match: "Sanctions match",
  incomplete: "Incomplete",
  other: "Other",
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: "Passport",
  drivers_license: "Driver's license",
  national_id: "National ID card",
};

export const HIT_TYPE_LABELS: Record<string, string> = {
  sanctions: "Sanctions",
  pep: "Politically exposed person",
  adverse_media: "Adverse media",
};

export function isCaseStatus(value: string): value is CaseStatus {
  return (CASE_STATUSES as readonly string[]).includes(value);
}

export function isRiskLevel(value: string): value is RiskLevel {
  return (RISK_LEVELS as readonly string[]).includes(value);
}

export function isSlaBreached(kase: { status: string; slaDueAt: Date }, now = new Date()): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(kase.status) && kase.slaDueAt.getTime() < now.getTime();
}
