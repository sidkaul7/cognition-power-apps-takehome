import Link from "next/link";
import { DataTable, type Column } from "@/platform/components/data-table/data-table";
import { parseTableParams, type RawSearchParams } from "@/platform/components/data-table/params";
import { formatAge, formatDateTime } from "@/platform/components/format";
import { can } from "@/platform/rbac/can";
import { requirePagePermission } from "@/platform/rbac/guards";
import { CASE_STATUSES, RISK_LABELS, RISK_LEVELS, STATUS_LABELS, isSlaBreached } from "../constants";
import { BreachedBadge, CaseStatusBadge, RiskBadge } from "../components/badges";
import { ClaimButton } from "../components/claim-button";
import { QUEUE_SORT_KEYS, listQueue, type QueueRow } from "../queries";
import { canClaim } from "../rules";

export async function QueuePage({ searchParams }: { searchParams: RawSearchParams }) {
  const user = await requirePagePermission("kyc:view");
  const isLead = can(user, "kyc:approve_high_risk");
  const params = parseTableParams(searchParams, {
    sortKeys: QUEUE_SORT_KEYS,
    defaultSort: "sla",
    defaultDir: "asc",
    filterKeys: ["status", "risk", "assignee"],
    // Compliance Leads land on their queue of escalated cases.
    filterDefaults: { status: isLead ? "escalated" : "all", risk: "all", assignee: "all" },
  });
  const { rows, total } = await listQueue(user, params);
  const now = new Date();

  const columns: Column<QueueRow>[] = [
    {
      key: "id",
      label: "Case ID",
      sortable: true,
      cell: (row) => (
        <Link href={`/kyc/cases/${row.id}`} className="font-medium text-blue-700 hover:underline">
          {row.id}
        </Link>
      ),
    },
    { key: "customer", label: "Customer", sortable: true, cell: (row) => row.customerName },
    { key: "risk", label: "Risk", sortable: true, cell: (row) => <RiskBadge level={row.riskLevel} /> },
    { key: "status", label: "Status", sortable: true, cell: (row) => <CaseStatusBadge status={row.status} /> },
    {
      key: "assignee",
      label: "Assignee",
      sortable: true,
      cell: (row) =>
        row.assignee ? (
          row.assignee.name
        ) : canClaim(user, row) ? (
          <ClaimButton caseId={row.id} />
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        ),
    },
    { key: "age", label: "Age", sortable: true, cell: (row) => formatAge(row.createdAt, now) },
    {
      key: "sla",
      label: "SLA due",
      sortable: true,
      cell: (row) => {
        const breached = isSlaBreached(row, now);
        return (
          <span className={breached ? "inline-flex items-center gap-2 font-medium text-red-700" : "inline-flex items-center gap-2"}>
            {formatDateTime(row.slaDueAt)}
            {breached ? <BreachedBadge /> : null}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">KYC review queue</h1>
        <p className="text-sm text-muted-foreground">
          {isLead ? "Showing escalated cases by default. Change the status filter to see everything." : "Cases sorted by SLA due time. Claim an unassigned case to start a review."}
        </p>
      </div>
      <DataTable
        basePath="/kyc"
        params={params}
        columns={columns}
        rows={rows}
        total={total}
        rowKey={(row) => row.id}
        searchPlaceholder="Customer name or case ID"
        filters={[
          { key: "status", label: "Status", type: "select", options: [{ value: "all", label: "All statuses" }, ...CASE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))] },
          { key: "risk", label: "Risk", type: "select", options: [{ value: "all", label: "All risk levels" }, ...RISK_LEVELS.map((r) => ({ value: r, label: RISK_LABELS[r] }))] },
          {
            key: "assignee",
            label: "Assignee",
            type: "select",
            options: [
              { value: "all", label: "All" },
              { value: "me", label: "Me" },
              { value: "unassigned", label: "Unassigned" },
            ],
          },
        ]}
        emptyMessage="No cases match these filters."
      />
    </div>
  );
}
