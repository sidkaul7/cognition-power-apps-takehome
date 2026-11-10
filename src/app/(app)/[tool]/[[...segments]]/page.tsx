import { notFound } from "next/navigation";
import { findInstalledTool } from "@/apps/registry";
import { requirePagePermission } from "@/platform/rbac/guards";

type Props = {
  params: Promise<{ tool: string; segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Routes every installed tool from the registry, so adding a tool needs no change to the shell.
export default async function ToolPage({ params, searchParams }: Props) {
  const { tool: toolPath, segments = [] } = await params;
  const tool = findInstalledTool(toolPath);
  if (!tool) notFound();
  const toolModule = await tool.load();
  await requirePagePermission(tool.requiredPermission, toolModule.recordRef?.(segments));
  return toolModule.render(segments, await searchParams);
}
