import { notFound } from "next/navigation";
import type { ToolModule } from "../types";
import { CASE_RECORD_TYPE } from "./constants";
import { CasePage } from "./pages/case-page";
import { QueuePage } from "./pages/queue-page";

// Routes: /kyc -> queue, /kyc/cases/<id> -> case page. The shell checks kyc:view before render.
const kyc: ToolModule = {
  recordRef: (segments) => (segments[0] === "cases" && segments[1] ? { type: CASE_RECORD_TYPE, id: segments[1] } : undefined),
  render: async (segments, searchParams) => {
    if (segments.length === 0) return QueuePage({ searchParams });
    if (segments.length === 2 && segments[0] === "cases") return CasePage({ caseId: decodeURIComponent(segments[1]) });
    notFound();
  },
};

export default kyc;
