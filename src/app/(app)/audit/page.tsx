import type { AuditEvent, Prisma } from "@prisma/client";
import { recordHref } from "@/apps/registry";
import { AUDIT_ACTION_LABELS, summarizeChange } from "@/platform/audit/labels";
import { VerifyIntegrityButton } from "@/platform/audit/verify-button";
import { DataTable, type Column } from "@/platform/components/data-table/data-table";
import { parseTableParams } from "@/platform/components/data-table/params";
import { formatDateTime } from "@/platform/components/format";
import { prisma } from "@/platform/db";
import { can } from "@/platform/rbac/can";
import { requirePagePermission } from "@/platform/rbac/guards";
import Link from "next/link";

const SORT_KEYS = ["id", "time", "actor", "action", "record"] as const;
const ORDER: Record<(typeof SORT_KEYS)[number], (dir: "asc" | "desc") => Prisma.AuditEventOrderByWithRelationInput> = {
  id: (dir) => ({ id: dir }),
  time: (dir) => ({ createdAt: dir }),
  actor: (dir) => ({ actorName: dir }),
  action: (dir) => ({ action: dir }),
  record: (dir) => ({ recordId: dir }),
};

function dayBound(value: string | undefined, end: boolean): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (end) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission("audit:view");
  const params = parseTableParams(await searchParams, {
    sortKeys: SORT_KEYS,
    defaultSort: "id",
    defaultDir: "desc",
    filterKeys: ["actor", "record", "from", "to"],
  });
  const { actor, record, from, to } = params.filters;
  const where: Prisma.AuditEventWhereInput = {};
  if (actor && actor !== "all") where.actorId = actor;
  if (record) where.recordId = { contains: record };
  const gte = dayBound(from, false);
  const lt = dayBound(to, true);
  if (gte || lt) where.createdAt = { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) };
  if (params.q) where.OR = [{ action: { contains: params.q } }, { reason: { contains: params.q } }, { actorName: { contains: params.q } }];

  const [rows, total, users] = await Promise.all([
    prisma.auditEvent.findMany({ where, orderBy: [ORDER[params.sort](params.dir), { id: "desc" }], skip: params.skip, take: params.take }),
    prisma.auditEvent.count({ where }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const columns: Column<AuditEvent>[] = [
    { key: "id", label: "#", sortable: true, cell: (e) => <span className="font-mono text-xs">{e.id}</span> },
    { key: "time", label: "Time", sortable: true, cell: (e) => <span className="whitespace-nowrap">{formatDateTime(e.createdAt)}</span> },
    { key: "actor", label: "Actor", sortable: true, cell: (e) => e.actorName ?? "Unknown" },
    {
      key: "action",
      label: "Action",
      sortable: true,
      cell: (e) => (
        <span title={AUDIT_ACTION_LABELS[e.action]}>
          <code className="text-xs">{e.action}</code>
        </span>
      ),
    },
    {
      key: "record",
      label: "Record",
      sortable: true,
      cell: (e) => {
        if (!e.recordId) return <span className="text-muted-foreground">None</span>;
        const href = e.recordType ? recordHref(e.recordType, e.recordId) : null;
        return href ? (
          <Link href={href} className="font-mono text-xs text-blue-700 hover:underline">
            {e.recordId}
          </Link>
        ) : (
          <span className="font-mono text-xs">{e.recordId}</span>
        );
      },
    },
    { key: "reason", label: "Reason", cell: (e) => <span className="block max-w-56 truncate" title={e.reason ?? ""}>{e.reason ?? ""}</span> },
    { key: "change", label: "Change", cell: (e) => <span className="block max-w-72 truncate text-xs text-muted-foreground" title={summarizeChange(e.before, e.after)}>{summarizeChange(e.before, e.after)}</span> },
    { key: "hash", label: "Hash", cell: (e) => <code className="text-xs text-muted-foreground" title={e.hash}>{e.hash.slice(0, 10)}</code> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">Append-only and hash-chained. PII in before and after values is masked.</p>
        </div>
        {can(user, "audit:verify") ? <VerifyIntegrityButton /> : null}
      </div>
      <DataTable
        basePath="/audit"
        params={params}
        columns={columns}
        rows={rows}
        total={total}
        rowKey={(e) => String(e.id)}
        searchPlaceholder="Action, actor, or reason"
        filters={[
          { key: "actor", label: "Actor", type: "select", options: [{ value: "all", label: "All actors" }, ...users.map((u) => ({ value: u.id, label: u.name })), { value: "system", label: "System (seed)" }] },
          { key: "record", label: "Record ID", type: "text", placeholder: "KYC-1001" },
          { key: "from", label: "From", type: "date" },
          { key: "to", label: "To", type: "date" },
        ]}
      />
    </div>
  );
}
