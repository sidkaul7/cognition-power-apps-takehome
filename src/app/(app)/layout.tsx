import { ClipboardCheck, Home, ScrollText } from "lucide-react";
import Link from "next/link";
import { installedToolsFor } from "@/apps/registry";
import { Button } from "@/components/ui/button";
import { listActionableApprovals } from "@/platform/approvals";
import { signOut } from "@/platform/auth/actions";
import { can } from "@/platform/rbac/can";
import { requireSignedIn } from "@/platform/rbac/guards";
import { ROLE_LABELS, isRole } from "@/platform/rbac/permissions";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSignedIn();
  const tools = installedToolsFor(user);
  const approvals = await listActionableApprovals(user);
  const link = "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted";

  return (
    <div className="flex flex-1">
      <aside className="w-60 shrink-0 border-r bg-muted/30 p-4">
        <Link href="/" className="mb-6 block text-sm font-semibold">
          Internal Tools
        </Link>
        <nav className="space-y-1" aria-label="Main">
          <Link href="/" className={link}>
            <Home className="size-4" /> Home
          </Link>
          {tools.map((tool) => (
            <Link key={tool.id} href={tool.path} className={link}>
              <tool.icon className="size-4" /> {tool.name}
            </Link>
          ))}
          <Link href="/approvals" className={link}>
            <ClipboardCheck className="size-4" /> My approvals
            {approvals.length > 0 ? <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-xs text-white">{approvals.length}</span> : null}
          </Link>
          {can(user, "audit:view") ? (
            <Link href="/audit" className={link}>
              <ScrollText className="size-4" /> Audit log
            </Link>
          ) : null}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b px-6 py-3 text-sm">
          <span>
            <span className="font-medium">{user.name}</span>{" "}
            <span className="text-muted-foreground">· {isRole(user.role) ? ROLE_LABELS[user.role] : user.role}</span>
          </span>
          <Button asChild variant="outline" size="sm">
            <Link href="/sign-in">Switch user</Link>
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
