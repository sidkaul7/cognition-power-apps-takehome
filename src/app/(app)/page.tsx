import Link from "next/link";
import { installedToolsFor, plannedTools } from "@/apps/registry";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/platform/components/status-badge";
import { requireSignedIn } from "@/platform/rbac/guards";

export default async function HomePage() {
  const user = await requireSignedIn();
  const tools = installedToolsFor(user);
  const planned = plannedTools();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
        <p className="text-sm text-muted-foreground">Tools you can access. Planned tools are not built yet.</p>
      </div>
      {tools.length === 0 ? <p className="text-sm text-muted-foreground">Your role has no installed tools yet.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link key={tool.id} href={tool.path} data-testid={`tile-${tool.id}`}>
            <Card className="h-full transition hover:border-foreground/30 hover:shadow-sm">
              <CardHeader>
                <tool.icon className="mb-2 size-6" />
                <CardTitle>{tool.name}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
        {planned.map((tool) => (
          <Card key={tool.id} aria-disabled className="h-full opacity-50 grayscale" data-testid={`tile-${tool.id}`}>
            <CardHeader>
              <div className="mb-2 flex items-center justify-between">
                <tool.icon className="size-6" />
                <StatusBadge label="Planned" tone="muted" />
              </div>
              <CardTitle>{tool.name}</CardTitle>
              <CardDescription>{tool.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
