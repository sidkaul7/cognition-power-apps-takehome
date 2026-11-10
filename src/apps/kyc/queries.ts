import type { Prisma } from "@prisma/client";
import { prisma } from "@/platform/db";
import type { TableParams } from "@/platform/components/data-table/params";
import { maskRecord } from "@/platform/pii/mask";
import type { Actor } from "@/platform/rbac/can";
import { CASE_RECORD_TYPE, isCaseStatus, isRiskLevel } from "./constants";

export const QUEUE_SORT_KEYS = ["id", "customer", "risk", "status", "assignee", "age", "sla"] as const;
export type QueueSortKey = (typeof QUEUE_SORT_KEYS)[number];

function orderBy(sort: QueueSortKey, dir: "asc" | "desc"): Prisma.KycCaseOrderByWithRelationInput[] {
  const flipped = dir === "asc" ? "desc" : "asc";
  const primary: Record<QueueSortKey, Prisma.KycCaseOrderByWithRelationInput> = {
    id: { id: dir },
    customer: { customerName: dir },
    // Scores fall in fixed bands per level (Low < 40 <= Medium < 70 <= High), so this also orders by level.
    risk: { riskScore: dir },
    status: { status: dir },
    assignee: { assignee: { name: dir } },
    age: { createdAt: flipped },
    sla: { slaDueAt: dir },
  };
  return [primary[sort], { id: "asc" }];
}

export function queueWhere(user: Actor, params: TableParams): Prisma.KycCaseWhereInput {
  const { status, risk, assignee } = params.filters;
  const where: Prisma.KycCaseWhereInput = {};
  if (status && isCaseStatus(status)) where.status = status;
  if (risk && isRiskLevel(risk)) where.riskLevel = risk;
  if (assignee === "me") where.assigneeId = user.id;
  if (assignee === "unassigned") where.assigneeId = null;
  // SQLite LIKE is case-insensitive for ASCII, so this search ignores case.
  if (params.q) where.OR = [{ customerName: { contains: params.q } }, { id: { contains: params.q } }];
  return where;
}

/** Queue rows. Selects no PII columns. */
export async function listQueue(user: Actor, params: TableParams<QueueSortKey>) {
  const where = queueWhere(user, params);
  const [rows, total] = await Promise.all([
    prisma.kycCase.findMany({
      where,
      orderBy: orderBy(params.sort, params.dir),
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        customerName: true,
        riskLevel: true,
        riskScore: true,
        status: true,
        assigneeId: true,
        createdAt: true,
        slaDueAt: true,
        assignee: { select: { name: true } },
      },
    }),
    prisma.kycCase.count({ where }),
  ]);
  return { rows, total };
}

export type QueueRow = Awaited<ReturnType<typeof listQueue>>["rows"][number];

/** The case with every PII field already masked. Raw values are only read by the reveal flow. */
export async function getMaskedCase(caseId: string) {
  const kase = await prisma.kycCase.findUnique({
    where: { id: caseId },
    include: { documents: { orderBy: { id: "asc" } }, screeningHits: { orderBy: { matchScore: "desc" } }, assignee: { select: { name: true } } },
  });
  return kase ? maskRecord(kase) : null;
}

export async function getCaseHistory(caseId: string) {
  return prisma.auditEvent.findMany({ where: { recordType: CASE_RECORD_TYPE, recordId: caseId }, orderBy: { id: "asc" } });
}
