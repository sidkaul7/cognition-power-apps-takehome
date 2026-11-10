import Link from "next/link";
import { recordHref } from "@/apps/registry";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listActionableApprovals } from "@/platform/approvals";
import { formatDateTime } from "@/platform/components/format";
import { requireSignedIn } from "@/platform/rbac/guards";

export default async function MyApprovalsPage() {
  const user = await requireSignedIn();
  const approvals = await listActionableApprovals(user);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My approvals</h1>
        <p className="text-sm text-muted-foreground">Pending approvals you can act on. You never see requests you made yourself.</p>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Requested by</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nothing is waiting for you.
                </TableCell>
              </TableRow>
            ) : (
              approvals.map((approval) => {
                const href = recordHref(approval.recordType, approval.recordId);
                return (
                  <TableRow key={approval.id}>
                    <TableCell>{approval.summary}</TableCell>
                    <TableCell className="font-mono text-xs">{approval.recordId}</TableCell>
                    <TableCell>{approval.requestedByName}</TableCell>
                    <TableCell>{formatDateTime(approval.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {href ? (
                        <Link href={href} className="font-medium text-blue-700 hover:underline">
                          Review
                        </Link>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
