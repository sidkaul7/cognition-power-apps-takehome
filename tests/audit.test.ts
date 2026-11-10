import { beforeAll, describe, expect, it } from "vitest";
import { buildSeedCases } from "../prisma/seed-data";
import { recordAudit, verifyAuditChain } from "@/platform/audit";
import { GENESIS_HASH, canonicalJson } from "@/platform/audit/hash";
import { prisma } from "@/platform/db";
import { claimCase, revealCaseField } from "@/apps/kyc/service";
import { ana, marcus, seedDatabase } from "./helpers";

beforeAll(seedDatabase);

describe("audit hash chain", () => {
  it("links every event to the previous hash, starting from the genesis hash", async () => {
    const events = await prisma.auditEvent.findMany({ orderBy: { id: "asc" } });
    expect(events[0].prevHash).toBe(GENESIS_HASH);
    for (let i = 1; i < events.length; i++) expect(events[i].prevHash).toBe(events[i - 1].hash);
    expect(await verifyAuditChain()).toEqual({ ok: true, checked: events.length });
  });

  it("canonicalJson sorts keys so the hash does not depend on key order", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(canonicalJson({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }));
  });

  it("writes the audit event in the same transaction, so a failed change leaves no event", async () => {
    const before = await prisma.auditEvent.count();
    await expect(
      prisma.$transaction(async (tx) => {
        await recordAudit(tx, { actor: ana, action: "case.claim", recordType: "kyc_case", recordId: "KYC-1002" });
        throw new Error("change failed");
      }),
    ).rejects.toThrow("change failed");
    expect(await prisma.auditEvent.count()).toBe(before);
  });

  it("stores before/after with PII masked and pii.reveal without the revealed value", async () => {
    await claimCase(ana, "KYC-1002");
    const ssn = await revealCaseField(marcus, { caseId: "KYC-1002", field: "ssn" }, "Verifying identity");
    expect(ssn).toMatch(/^\d{3}-\d{2}-\d{4}$/);
    const events = await prisma.auditEvent.findMany();
    const stored = events.map((e) => `${e.before ?? ""} ${e.after ?? ""} ${e.reason ?? ""}`).join("\n");
    for (const c of buildSeedCases()) {
      expect(stored).not.toContain(c.ssn);
      expect(stored).not.toContain(c.address);
      expect(stored).not.toContain(c.dateOfBirth);
      for (const doc of c.documents) expect(stored).not.toContain(doc.documentNumber);
    }
    const reveal = events.find((e) => e.action === "pii.reveal");
    expect(reveal).toMatchObject({ actorId: marcus.id, recordId: "KYC-1002", reason: "Verifying identity" });
    expect(JSON.parse(reveal!.after!)).toEqual({ field: "ssn" });
  });

  it("detects an edited event and reports where the chain breaks", async () => {
    expect((await verifyAuditChain()).ok).toBe(true);
    const target = await prisma.auditEvent.findFirstOrThrow({ where: { action: "case.claim" }, orderBy: { id: "asc" } });
    await prisma.$executeRaw`UPDATE AuditEvent SET actorName = 'Someone Else' WHERE id = ${target.id}`;
    const result = await verifyAuditChain();
    expect(result).toMatchObject({ ok: false, brokenEventId: target.id });
    await prisma.$executeRaw`UPDATE AuditEvent SET actorName = ${target.actorName} WHERE id = ${target.id}`;
    expect((await verifyAuditChain()).ok).toBe(true);
  });

  it("detects a deleted event", async () => {
    const events = await prisma.auditEvent.findMany({ orderBy: { id: "asc" }, take: 6 });
    await prisma.$executeRaw`DELETE FROM AuditEvent WHERE id = ${events[4].id}`;
    expect(await verifyAuditChain()).toMatchObject({ ok: false, brokenEventId: events[5].id });
  });
});
