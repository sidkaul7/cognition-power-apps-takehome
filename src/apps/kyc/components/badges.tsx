import { StatusBadge } from "@/platform/components/status-badge";
import { RISK_LABELS, RISK_TONES, STATUS_LABELS, STATUS_TONES, isCaseStatus, isRiskLevel } from "../constants";

export function CaseStatusBadge({ status }: { status: string }) {
  return isCaseStatus(status) ? <StatusBadge label={STATUS_LABELS[status]} tone={STATUS_TONES[status]} /> : <StatusBadge label={status} />;
}

export function RiskBadge({ level }: { level: string }) {
  return isRiskLevel(level) ? <StatusBadge label={RISK_LABELS[level]} tone={RISK_TONES[level]} /> : <StatusBadge label={level} />;
}

export function BreachedBadge() {
  return <StatusBadge label="Breached" tone="danger" className="bg-red-600 text-white ring-red-600" />;
}
