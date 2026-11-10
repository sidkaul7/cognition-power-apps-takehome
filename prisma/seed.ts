import { PrismaClient } from "@prisma/client";
import { recordAudit } from "../src/platform/audit";
import { databaseUrl } from "../src/platform/config";
import { SEED_USERS, buildSeedCases } from "./seed-data";

const prisma = new PrismaClient({ datasourceUrl: databaseUrl() });
const HOUR = 60 * 60 * 1000;
const SYSTEM = { id: "system", name: "System (seed)" };

export async function seed(db: PrismaClient = prisma, now = new Date()) {
  const users = Object.fromEntries(SEED_USERS.map((user) => [user.id, user]));
  await db.user.createMany({ data: [...SEED_USERS] });

  for (const c of buildSeedCases()) {
    const createdAt = new Date(now.getTime() - c.hoursAgo * HOUR);
    const at = (hours: number) => new Date(createdAt.getTime() + hours * HOUR);
    await db.$transaction(async (tx) => {
      await tx.kycCase.create({
        data: {
          id: c.id,
          customerName: c.customerName,
          email: c.email,
          ssn: c.ssn,
          dateOfBirth: c.dateOfBirth,
          address: c.address,
          country: c.country,
          riskLevel: c.riskLevel,
          riskScore: c.riskScore,
          status: c.status,
          assigneeId: c.assigneeId,
          decisionNote: c.status === "escalated" ? "Screening hit needs a Compliance Lead review." : c.status === "rejected" ? "Name on ID does not match application." : null,
          rejectionReasonCode: c.status === "rejected" ? "document_mismatch" : null,
          createdAt,
          slaDueAt: new Date(createdAt.getTime() + 48 * HOUR),
          documents: { create: c.documents },
          screeningHits: { create: c.hits },
        },
      });
      const record = { recordType: "kyc_case", recordId: c.id };
      await recordAudit(tx, {
        actor: SYSTEM,
        action: "case.create",
        ...record,
        after: { status: "new", riskLevel: c.riskLevel, riskScore: c.riskScore, ssn: c.ssn, dateOfBirth: c.dateOfBirth, address: c.address },
        at: createdAt,
      });
      if (c.status === "new" || !c.assigneeId) return;
      const actor = users[c.assigneeId];
      const claimed = { status: "in_review", assigneeId: c.assigneeId };
      await recordAudit(tx, { actor, action: "case.claim", ...record, before: { status: "new", assigneeId: null }, after: claimed, at: at(0.5) });
      if (c.status === "escalated") {
        await recordAudit(tx, { actor, action: "case.escalate", ...record, before: claimed, after: { ...claimed, status: "escalated" }, reason: "Screening hit needs a Compliance Lead review.", at: at(1) });
      } else if (c.status === "approved") {
        await recordAudit(tx, { actor, action: "case.approve", ...record, before: claimed, after: { ...claimed, status: "approved", stage: "final" }, at: at(1) });
      } else if (c.status === "rejected") {
        await recordAudit(tx, {
          actor,
          action: "case.reject",
          ...record,
          before: claimed,
          after: { ...claimed, status: "rejected", rejectionReasonCode: "document_mismatch" },
          reason: "Document mismatch: Name on ID does not match application.",
          at: at(1),
        });
      }
    });
  }
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/seed.ts");
if (isMain) {
  seed()
    .then(async () => {
      const cases = await prisma.kycCase.count();
      const events = await prisma.auditEvent.count();
      console.log(`Seeded ${SEED_USERS.length} users, ${cases} cases, and ${events} audit events.`);
    })
    .finally(() => prisma.$disconnect());
}
