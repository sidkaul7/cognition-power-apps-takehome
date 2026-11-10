"use server";

import { z } from "zod";
import { secureAction } from "../rbac/guards";
import { verifyAuditChain } from "./index";

export const verifyAuditAction = secureAction({ permission: "audit:verify", schema: z.object({}) }, async () => verifyAuditChain());
