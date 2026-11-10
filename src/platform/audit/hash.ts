import { createHash } from "node:crypto";

export const GENESIS_HASH = "0".repeat(64);

export type HashableAuditEvent = {
  actorId: string | null;
  actorName: string | null;
  action: string;
  recordType: string | null;
  recordId: string | null;
  before: string | null;
  after: string | null;
  reason: string | null;
  createdAt: Date;
  prevHash: string;
};

/** JSON with keys sorted alphabetically at every level and dates written as ISO 8601 UTC. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const inner = (value as Record<string, unknown>)[key];
      if (inner !== undefined) out[key] = normalize(inner);
    }
    return out;
  }
  return value;
}

/** SHA-256 of the event's canonical JSON: every field except its ID and its own hash. */
export function hashAuditEvent(event: HashableAuditEvent): string {
  const fields: HashableAuditEvent = {
    actorId: event.actorId,
    actorName: event.actorName,
    action: event.action,
    recordType: event.recordType,
    recordId: event.recordId,
    before: event.before,
    after: event.after,
    reason: event.reason,
    createdAt: event.createdAt,
    prevHash: event.prevHash,
  };
  return createHash("sha256").update(canonicalJson(fields)).digest("hex");
}
