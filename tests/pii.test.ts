import { beforeAll, describe, expect, it } from "vitest";
import { buildSeedCases } from "../prisma/seed-data";
import { revealCaseField } from "@/apps/kyc/service";
import { getMaskedCase, listQueue } from "@/apps/kyc/queries";
import { prisma } from "@/platform/db";
import { ForbiddenError, RuleError } from "@/platform/errors";
import { maskAddress, maskDateOfBirth, maskDocumentNumber, maskRecord, maskSsn, maskSsnsInText } from "@/platform/pii";
import { parseTableParams } from "@/platform/components/data-table/params";
import { QUEUE_SORT_KEYS } from "@/apps/kyc/queries";
import { ana, marcus, sam, seedDatabase } from "./helpers";

beforeAll(seedDatabase);

describe("masking", () => {
  it("masks each PII type", () => {
    expect(maskSsn("912-34-5678")).toBe("***-**-5678");
    expect(maskDateOfBirth("1990-04-12")).toBe("**/**/1990");
    expect(maskDocumentNumber("P12345678")).toBe("*****5678");
    const address = maskAddress("1234 Maple Ave, Springfield, IL 62704");
    expect(address).not.toContain("1234");
    expect(address).not.toContain("Maple");
    expect(address).toContain("Springfield, IL 62704");
  });

  it("masks PII keys anywhere in a nested record and leaves other keys alone", () => {
    const masked = maskRecord({ status: "new", ssn: "912-34-5678", nested: [{ documentNumber: "P12345678", type: "passport" }] });
    expect(masked).toEqual({ status: "new", ssn: "***-**-5678", nested: [{ documentNumber: "*****5678", type: "passport" }] });
  });

  it("returns masked case data by default and no PII columns in the queue", async () => {
    const seedCase = buildSeedCases()[0];
    const kase = await getMaskedCase(seedCase.id);
    expect(kase?.ssn).toBe(maskSsn(seedCase.ssn));
    expect(kase?.dateOfBirth).toBe(maskDateOfBirth(seedCase.dateOfBirth));
    expect(kase?.address).not.toBe(seedCase.address);
    expect(kase?.documents[0].documentNumber).toBe(maskDocumentNumber(seedCase.documents[0].documentNumber));
    const queue = await listQueue(ana, parseTableParams({}, { sortKeys: QUEUE_SORT_KEYS, defaultSort: "sla", filterKeys: ["status", "risk", "assignee"] }));
    for (const row of queue.rows) expect(Object.keys(row)).not.toEqual(expect.arrayContaining(["ssn"]));
  });
});

describe("reveal", () => {
  it("requires kyc:reveal_pii", async () => {
    for (const user of [ana, sam]) await expect(revealCaseField(user, { caseId: "KYC-1001", field: "ssn" }, "Need it")).rejects.toThrow(ForbiddenError);
  });

  it("requires a typed reason", async () => {
    await expect(revealCaseField(marcus, { caseId: "KYC-1001", field: "ssn" }, "   ")).rejects.toThrow(RuleError);
    expect(await prisma.auditEvent.count({ where: { action: "pii.reveal" } })).toBe(0);
  });

  it("returns one raw value and logs one pii.reveal per field", async () => {
    const seedCase = buildSeedCases()[0];
    expect(await revealCaseField(marcus, { caseId: seedCase.id, field: "dateOfBirth" }, "Age check")).toBe(seedCase.dateOfBirth);
    const doc = seedCase.documents[0];
    expect(await revealCaseField(marcus, { caseId: seedCase.id, field: "documentNumber", documentId: doc.id }, "Match passport")).toBe(doc.documentNumber);
    const reveals = await prisma.auditEvent.findMany({ where: { action: "pii.reveal" }, orderBy: { id: "asc" } });
    expect(reveals.map((e) => JSON.parse(e.after!))).toEqual([{ field: "dateOfBirth" }, { field: "documentNumber", documentId: doc.id }]);
    expect(reveals.map((e) => e.reason)).toEqual(["Age check", "Match passport"]);
  });
});

describe("SSN-shaped text in notes", () => {
  it("masks SSNs written with dashes, spaces, or no separator, keeping the last four digits", () => {
    expect(maskSsnsInText("SSN 123-45-6789 confirmed")).toBe("SSN ***-**-6789 confirmed");
    expect(maskSsnsInText("123 45 6789")).toBe("***-**-6789");
    expect(maskSsnsInText("ssn:123456789.")).toBe("ssn:***-**-6789.");
    expect(maskSsnsInText("a 111-22-3333 and b 444-55-6666")).toBe("a ***-**-3333 and b ***-**-6666");
  });

  it("leaves text that is not shaped like an SSN alone", () => {
    for (const text of ["Case KYC-1013", "Score 92, list OFAC SDN", "1234567890", "123-456-7890", "12-345-6789", "123-45 6789", ""]) {
      expect(maskSsnsInText(text)).toBe(text);
    }
  });
});
