// The single permission map. Must match the table in docs/PRD.md and README.md.

export const ROLES = ["kyc_analyst", "compliance_lead", "support_agent", "platform_admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  kyc_analyst: "KYC Analyst",
  compliance_lead: "Compliance Lead",
  support_agent: "Support Agent",
  platform_admin: "Platform Admin",
};

export const PERMISSIONS = [
  "kyc:view",
  "kyc:claim",
  "kyc:decide",
  "kyc:approve_high_risk",
  "kyc:reveal_pii",
  "audit:view",
  "audit:verify",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  kyc_analyst: ["kyc:view", "kyc:claim", "kyc:decide"],
  compliance_lead: ["kyc:view", "kyc:decide", "kyc:approve_high_risk", "kyc:reveal_pii", "audit:view"],
  support_agent: [],
  platform_admin: ["kyc:view", "audit:view", "audit:verify"],
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
