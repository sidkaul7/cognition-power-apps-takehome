import Link from "next/link";
import { notFound } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { findPendingApproval } from "@/platform/approvals";
import { AuditHistory } from "@/platform/audit/audit-history";
import { DetailLayout, DetailSection, FieldList } from "@/platform/components/detail-layout";
import { formatAge, formatDateTime } from "@/platform/components/format";
import { MaskedField } from "@/platform/components/masked-field";
import { prisma } from "@/platform/db";
import { can } from "@/platform/rbac/can";
import { requirePagePermission } from "@/platform/rbac/guards";
import { revealCasePii } from "../actions";
import { BreachedBadge, CaseStatusBadge, RiskBadge } from "../components/badges";
import { CaseDecisionPanel } from "../components/case-decision-panel";
import { CASE_RECORD_TYPE, DOCUMENT_TYPE_LABELS, HIT_TYPE_LABELS, REJECTION_REASON_LABELS, isSlaBreached, type RejectionReasonCode } from "../constants";
import { getCaseHistory, getMaskedCase } from "../queries";
import { allowedDecisions } from "../rules";

export async function CasePage({ caseId }: { caseId: string }) {
  const user = await requirePagePermission("kyc:view", { type: CASE_RECORD_TYPE, id: caseId });
  const kase = await getMaskedCase(caseId);
  if (!kase) notFound();
  const [history, pending] = await Promise.all([getCaseHistory(caseId), findPendingApproval(prisma, CASE_RECORD_TYPE, caseId)]);

  const now = new Date();
  const breached = isSlaBreached(kase, now);
  const canReveal = can(user, "kyc:reveal_pii");
  const decisions = allowedDecisions(user, kase, pending);
  const mode = kase.status === "pending_second_approval" ? "second_approval" : "case";
  const reveal = (target: Parameters<typeof revealCasePii>[0]) => (canReveal ? revealCasePii.bind(null, target) : undefined);

  let emptyMessage = "No decision is available.";
  if (!can(user, "kyc:decide")) emptyMessage = "Read-only. Your role can view cases but not decide them.";
  else if (kase.status === "new") emptyMessage = can(user, "kyc:claim") ? "Claim this case from the queue to decide it." : "Waiting for an analyst to claim this case.";
  else if (kase.status === "in_review") emptyMessage = "Only the analyst who claimed this case can decide it.";
  else if (kase.status === "pending_second_approval")
    emptyMessage = pending?.requestedById === user.id ? "Waiting for a second approval from a Compliance Lead. You gave the first approval." : "Waiting for a second approval from a Compliance Lead.";
  else if (kase.status === "escalated") emptyMessage = "Escalated. Waiting for a Compliance Lead's decision.";
  else emptyMessage = "This case is closed.";

  return (
    <DetailLayout
      title={`${kase.id} · ${kase.customerName}`}
      backLink={
        <Link href="/kyc" className="text-sm text-blue-700 hover:underline">
          Back to queue
        </Link>
      }
      badges={
        <>
          <CaseStatusBadge status={kase.status} />
          <RiskBadge level={kase.riskLevel} />
          {breached ? <BreachedBadge /> : null}
        </>
      }
      subtitle={<>Created {formatDateTime(kase.createdAt)} · Age {formatAge(kase.createdAt, now)} · Assignee {kase.assignee?.name ?? "Unassigned"}</>}
      aside={
        <>
          <CaseDecisionPanel
            caseId={kase.id}
            mode={mode}
            decisions={decisions}
            isHighFirstApproval={kase.status === "in_review" && kase.riskLevel === "high"}
            emptyMessage={emptyMessage}
            description={pending ? `First approval by ${pending.requestedByName} on ${formatDateTime(pending.createdAt)}.` : undefined}
          />
          <DetailSection title="Risk">
            <FieldList
              fields={[
                { label: "Risk level", value: <RiskBadge level={kase.riskLevel} /> },
                { label: "Risk score", value: <span className="text-lg font-semibold">{kase.riskScore} / 100</span> },
                {
                  label: "SLA due",
                  value: (
                    <span className={breached ? "inline-flex items-center gap-2 font-medium text-red-700" : ""}>
                      {formatDateTime(kase.slaDueAt)} {breached ? <BreachedBadge /> : null}
                    </span>
                  ),
                },
                { label: "Screening hits", value: kase.screeningHits.length },
              ]}
            />
          </DetailSection>
          {kase.decisionNote || kase.rejectionReasonCode ? (
            <DetailSection title="Latest decision note">
              <p className="text-sm">
                {kase.rejectionReasonCode ? <strong>{REJECTION_REASON_LABELS[kase.rejectionReasonCode as RejectionReasonCode] ?? kase.rejectionReasonCode}: </strong> : null}
                {kase.decisionNote}
              </p>
            </DetailSection>
          ) : null}
        </>
      }
    >
      <DetailSection title="Customer profile">
        <FieldList
          fields={[
            { label: "Customer name", value: kase.customerName },
            { label: "Email", value: kase.email },
            { label: "SSN", value: <MaskedField label="SSN" masked={kase.ssn} onReveal={reveal({ caseId, field: "ssn" })} /> },
            { label: "Date of birth", value: <MaskedField label="Date of birth" masked={kase.dateOfBirth} onReveal={reveal({ caseId, field: "dateOfBirth" })} /> },
            { label: "Address", value: <MaskedField label="Address" masked={kase.address} onReveal={reveal({ caseId, field: "address" })} /> },
            { label: "Country", value: kase.country },
          ]}
        />
      </DetailSection>

      <DetailSection title="ID documents">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Document number</TableHead>
              <TableHead>File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kase.documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>{DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type}</TableCell>
                <TableCell>
                  <MaskedField label={`${DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type} number`} masked={doc.documentNumber} onReveal={reveal({ caseId, field: "documentNumber", documentId: doc.id })} />
                </TableCell>
                <TableCell className="font-mono text-xs">{doc.fileName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DetailSection>

      <DetailSection title={`Screening hits (${kase.screeningHits.length})`}>
        {kase.screeningHits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No screening hits.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Matched name</TableHead>
                  <TableHead>Source list</TableHead>
                  <TableHead className="text-right">Match score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kase.screeningHits.map((hit) => (
                  <TableRow key={hit.id}>
                    <TableCell>{HIT_TYPE_LABELS[hit.type] ?? hit.type}</TableCell>
                    <TableCell>{hit.matchedName}</TableCell>
                    <TableCell>{hit.sourceList}</TableCell>
                    <TableCell className="text-right font-medium">{hit.matchScore} / 100</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">Match scores inform the reviewer and don&apos;t change the rules.</p>
          </>
        )}
      </DetailSection>

      <DetailSection title="History">
        <AuditHistory events={history} />
      </DetailSection>
    </DetailLayout>
  );
}
