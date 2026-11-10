import { prisma, type Tx } from "../db";
import { maskRecord } from "../pii/mask";
import type { Actor } from "../rbac/can";
import { GENESIS_HASH, canonicalJson, hashAuditEvent } from "./hash";

export const AUDIT_ACTIONS = [
  "auth.sign_in",
  "auth.denied",
  "case.create",
  "case.claim",
  "case.approve",
  "case.reject",
  "case.escalate",
  "approval.request",
  "approval.approve",
  "approval.reject",
  "pii.reveal",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditInput = {
  actor: Pick<Actor, "id" | "name"> | null;
  action: AuditAction;
  recordType?: string | null;
  recordId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  at?: Date;
};

function serialize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return canonicalJson(maskRecord(value));
}

/**
 * Appends an audit event to the hash chain. Always pass the `tx` of the transaction
 * that makes the change, so the change and its event commit or fail together.
 * Before/after values are masked, so events never contain unmasked PII.
 */
export async function recordAudit(tx: Tx, input: AuditInput) {
  const last = await tx.auditEvent.findFirst({ orderBy: { id: "desc" }, select: { hash: true } });
  const data = {
    actorId: input.actor?.id ?? null,
    actorName: input.actor?.name ?? null,
    action: input.action,
    recordType: input.recordType ?? null,
    recordId: input.recordId ?? null,
    before: serialize(input.before),
    after: serialize(input.after),
    reason: input.reason ?? null,
    createdAt: new Date((input.at ?? new Date()).toISOString()),
    prevHash: last?.hash ?? GENESIS_HASH,
  };
  // prevHash is unique, so two concurrent writers cannot fork the chain.
  return tx.auditEvent.create({ data: { ...data, hash: hashAuditEvent(data) } });
}

export type ChainVerification =
  | { ok: true; checked: number }
  | { ok: false; checked: number; brokenEventId: number; problem: string };

/** Recomputes every hash in order and reports the first event that does not match. */
export async function verifyAuditChain(db: Pick<Tx, "auditEvent"> = prisma): Promise<ChainVerification> {
  const events = await db.auditEvent.findMany({ orderBy: { id: "asc" } });
  let prevHash = GENESIS_HASH;
  for (const [index, event] of events.entries()) {
    if (event.prevHash !== prevHash) {
      return { ok: false, checked: index, brokenEventId: event.id, problem: "Previous-hash link does not match the prior event." };
    }
    if (hashAuditEvent(event) !== event.hash) {
      return { ok: false, checked: index, brokenEventId: event.id, problem: "Stored hash does not match the event's contents." };
    }
    prevHash = event.hash;
  }
  return { ok: true, checked: events.length };
}
