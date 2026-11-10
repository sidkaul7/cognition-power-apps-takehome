import { seed } from "../prisma/seed";
import { prisma } from "@/platform/db";
import type { Actor } from "@/platform/rbac/can";

export const ana: Actor = { id: "u-ana", name: "Ana Lima", role: "kyc_analyst" };
export const marcus: Actor = { id: "u-marcus", name: "Marcus Reed", role: "compliance_lead" };
export const priya: Actor = { id: "u-priya", name: "Priya Shah", role: "support_agent" };
export const sam: Actor = { id: "u-sam", name: "Sam Park", role: "platform_admin" };

export async function seedDatabase() {
  await seed(prisma);
}

export async function eventsFor(recordId: string) {
  return prisma.auditEvent.findMany({ where: { recordId }, orderBy: { id: "asc" } });
}
