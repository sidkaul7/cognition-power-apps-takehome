import { Flag, ReceiptText, ShieldCheck } from "lucide-react";
import { can, type Actor } from "@/platform/rbac/can";
import type { InstalledTool, PlannedTool, ToolEntry } from "./types";

// Every tool registers here. The home page, sidebar, and router are built from this list.
export const TOOLS: ToolEntry[] = [
  {
    id: "kyc",
    name: "KYC review queue",
    description: "Review customer identity cases, screening hits, and risk, with two-person approval on high-risk cases.",
    path: "/kyc",
    icon: ShieldCheck,
    requiredPermission: "kyc:view",
    status: "installed",
    load: () => import("./kyc").then((m) => m.default),
    recordHref: (recordType, recordId) => (recordType === "kyc_case" ? `/kyc/cases/${recordId}` : null),
  },
  {
    id: "refunds",
    name: "Refunds dashboard",
    description: "Review and approve customer refund requests.",
    path: "/refunds",
    icon: ReceiptText,
    status: "planned",
  },
  {
    id: "feature-flags",
    name: "Feature-flag admin",
    description: "Change feature flags in production with approval and audit.",
    path: "/feature-flags",
    icon: Flag,
    status: "planned",
  },
];

function isInstalled(tool: ToolEntry): tool is InstalledTool {
  return tool.status === "installed";
}

export function installedToolsFor(user: Actor): InstalledTool[] {
  return TOOLS.filter(isInstalled).filter((tool) => can(user, tool.requiredPermission));
}

export function plannedTools(): PlannedTool[] {
  return TOOLS.filter((tool): tool is PlannedTool => tool.status === "planned");
}

export function findInstalledTool(firstSegment: string): InstalledTool | undefined {
  return TOOLS.filter(isInstalled).find((tool) => tool.path === `/${firstSegment}`);
}

export function recordHref(recordType: string, recordId: string): string | null {
  for (const tool of TOOLS.filter(isInstalled)) {
    const href = tool.recordHref?.(recordType, recordId);
    if (href) return href;
  }
  return null;
}
