import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/platform/auth";
import { signIn } from "@/platform/auth/actions";
import { prisma } from "@/platform/db";
import { ROLE_LABELS, isRole } from "@/platform/rbac/permissions";

const DESCRIPTIONS: Record<string, string> = {
  kyc_analyst: "Claims cases, decides them, and gives the first approval on high-risk ones.",
  compliance_lead: "Gives the second approval on High cases, decides escalated cases, and can reveal PII.",
  support_agent: "Has no KYC access, which shows the permission checks at work.",
  platform_admin: "Reviews the audit log and checks its integrity.",
};

export default async function SignInPage() {
  const [users, current] = await Promise.all([prisma.user.findMany({ orderBy: { name: "asc" } }), getCurrentUser()]);
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 text-sm text-muted-foreground">Choose a demo user. All data is fake.</p>
      <div className="grid gap-3">
        {users.map((user) => (
          <Card key={user.id} className={current?.id === user.id ? "ring-2 ring-blue-500" : undefined}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>{user.name}</CardTitle>
                <CardDescription>{isRole(user.role) ? ROLE_LABELS[user.role] : user.role}</CardDescription>
              </div>
              <form action={signIn}>
                <input type="hidden" name="userId" value={user.id} />
                <Button type="submit">Sign in as {user.name.split(" ")[0]}</Button>
              </form>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{DESCRIPTIONS[user.role]}</CardContent>
          </Card>
        ))}
        {users.length === 0 ? <p className="text-sm text-destructive">No users found. Run npm run db:reset.</p> : null}
      </div>
    </main>
  );
}
