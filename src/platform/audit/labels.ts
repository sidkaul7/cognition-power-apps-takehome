export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.sign_in": "Signed in",
  "auth.denied": "Access denied",
  "case.create": "Case created",
  "case.claim": "Claimed",
  "case.approve": "Approved",
  "case.reject": "Rejected",
  "case.escalate": "Escalated",
  "approval.request": "Approval requested",
  "approval.approve": "Approval granted",
  "approval.reject": "Approval rejected",
  "pii.reveal": "PII revealed",
};

/** Short "key: before -> after" summary of an event's masked before/after JSON. */
export function summarizeChange(before: string | null, after: string | null): string {
  const b = parse(before);
  const a = parse(after);
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
  return keys
    .map((key) => {
      if (key in b && key in a && b[key] !== a[key]) return `${key}: ${fmt(b[key])} → ${fmt(a[key])}`;
      if (key in a && !(key in b)) return `${key}: ${fmt(a[key])}`;
      return null;
    })
    .filter(Boolean)
    .join(", ");
}

function parse(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function fmt(value: unknown): string {
  return value === null || value === undefined ? "none" : String(value);
}
