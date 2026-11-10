import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { RecordRef } from "@/platform/rbac/guards";
import type { Permission } from "@/platform/rbac/permissions";

export type SearchParams = Record<string, string | string[] | undefined>;

/** What each tool folder exports from its `index.ts`. The shell routes `/<path>/<...segments>` to it. */
export type ToolModule = {
  /** The record a URL points at, so a denied request is audited against it. */
  recordRef?: (segments: string[]) => RecordRef | undefined;
  render: (segments: string[], searchParams: SearchParams) => Promise<ReactNode>;
};

type ToolBase = {
  id: string;
  name: string;
  description: string;
  /** URL path the tool is served at, such as `/kyc`. */
  path: `/${string}`;
  icon: LucideIcon;
};

export type InstalledTool = ToolBase & {
  status: "installed";
  requiredPermission: Permission;
  load: () => Promise<ToolModule>;
  /** Link for a record this tool owns, used by "My approvals". */
  recordHref?: (recordType: string, recordId: string) => string | null;
};

/** Shown on the home page as a greyed-out tile with a "Planned" badge and no link. */
export type PlannedTool = ToolBase & { status: "planned" };

export type ToolEntry = InstalledTool | PlannedTool;
