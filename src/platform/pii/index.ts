import type { Tx } from "../db";
import { recordAudit } from "../audit";
import { requirePermission, type Actor } from "../rbac/can";
import { RuleError } from "../errors";
import type { PiiField } from "./mask";

export * from "./mask";

type RevealInput = {
  actor: Actor;
  field: PiiField;
  /** The raw value, loaded by the tool for this one field. */
  value: string;
  recordType: string;
  recordId: string;
  reason: string;
  /** Extra non-PII detail for the event, such as which document. */
  detail?: Record<string, string>;
};

/**
 * The only path that returns an unmasked value. Requires `kyc:reveal_pii` and a typed reason,
 * and writes a `pii.reveal` event naming the field (never the value) in the same transaction.
 */
export async function revealPii(tx: Tx, input: RevealInput): Promise<string> {
  requirePermission(input.actor, "kyc:reveal_pii");
  const reason = input.reason.trim();
  if (!reason) throw new RuleError("A reason is required to reveal PII.");
  await recordAudit(tx, {
    actor: input.actor,
    action: "pii.reveal",
    recordType: input.recordType,
    recordId: input.recordId,
    after: { field: input.field, ...input.detail },
    reason,
  });
  return input.value;
}
