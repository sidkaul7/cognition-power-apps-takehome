---
name: new-internal-tool
description: Step-by-step guide to adding a new internal tool (such as the refunds dashboard or feature-flag admin) to this repo, reusing the platform controls in src/platform and the KYC queue in src/apps/kyc as the reference.
---

# Add a new internal tool

Use this when asked to build a new tool on the internal tools platform. The KYC review queue in `src/apps/kyc` is the working reference: copy its shape. Follow every rule in `AGENTS.md`.

The examples use the refunds dashboard (`refunds`). Replace the names for other tools.

## 1. List open questions before starting

Write down the answers, or ask, before writing code:

- Who uses the tool, and which existing role (`kyc_analyst`, `compliance_lead`, `support_agent`, `platform_admin`) or new role does each user have?
- What records does it show, and what are their statuses and allowed transitions?
- Which actions write data, and who may perform each one?
- Which fields are PII? (Names, SSNs, dates of birth, addresses, ID and account numbers.)
- Which actions move money or change production? Those need two-person approval. What is the threshold, if any?
- Which actions need a reason or reason code?
- What is the default sort, and which filters does the list need?

If an answer is missing, choose the simplest option that keeps the controls intact and note it in the pull request.

## 2. Add Prisma models and seed data

- Add models to `prisma/schema.prisma`, prefixed with the tool name (for example `RefundRequest`). Use `String` IDs that read well in the UI (`RF-1001`), `String` status fields, and `@@index` on fields used for filtering and sorting. See `KycCase`.
- Do not change `User`, `AuditEvent`, or `Approval`. Approvals link to any record through `appId`, `recordType`, and `recordId`.
- Put fake seed data in a builder like `buildSeedCases()` in `prisma/seed-data.ts`: made-up names, `example.com` emails, invented numbers, deterministic values.
- In `prisma/seed.ts`, create each record inside `db.$transaction(async (tx) => ...)` and call `recordAudit(tx, { actor: SYSTEM, action: "<record>.create", ... })` so history starts at creation.
- Add any new action names to `AUDIT_ACTIONS` in `src/platform/audit/index.ts` and labels to `AUDIT_ACTION_LABELS` in `src/platform/audit/labels.ts`.
- Run `npm run db:reset`.

## 3. Add permissions

- Add permissions such as `refunds:view`, `refunds:request`, and `refunds:approve` to `PERMISSIONS` in `src/platform/rbac/permissions.ts`, then grant them to roles in `ROLE_PERMISSIONS`.
- Add the same rows to the permission table in `README.md`, and the user table if a role's description changes.
- Update the expected map in `tests/permissions.test.ts`. The test fails until the code and the table agree.

## 4. Register the tool

In `src/apps/registry.ts`, change the planned entry to an installed one:

```ts
{
  id: "refunds",
  name: "Refunds dashboard",
  description: "Review and approve customer refund requests.",
  path: "/refunds",
  icon: ReceiptText,
  requiredPermission: "refunds:view",
  status: "installed",
  load: () => import("./refunds").then((m) => m.default),
  recordHref: (recordType, recordId) => (recordType === "refund_request" ? `/refunds/requests/${recordId}` : null),
},
```

The home page, sidebar, and `src/app/(app)/[tool]/[[...segments]]/page.tsx` read the registry. Do not edit the shell. The dynamic route calls `requirePagePermission(tool.requiredPermission, ...)` before rendering, so users without the permission get a 403 and an `auth.denied` event.

## 5. Build the tool folder

Mirror `src/apps/kyc`:

```
src/apps/refunds/
  index.ts        default export: ToolModule { recordRef, render } routing segments to pages
  constants.ts    APP_ID, RECORD_TYPE, statuses, labels, reason codes
  rules.ts        pure functions: which actions a user may take on a record
  service.ts      writes: permission check + rule check + change + audit in one transaction
  actions.ts      "use server" wrappers built with secureAction()
  queries.ts      reads: list with filters and paging, masked detail, history
  pages/          list page and detail page
  components/     small client components, such as a decision panel wrapper
```

`index.ts` follows `src/apps/kyc/index.ts`: return the list page for `[]`, the detail page for `["requests", id]`, and call `notFound()` otherwise. `recordRef` returns `{ type: RECORD_TYPE, id }` for detail URLs so denials are audited against the record.

## 6. Build pages from the shared components

Import from `src/platform/components`:

- List page: `parseTableParams()` for sort, filter, search, and page from the URL, then `DataTable` with `Column<Row>[]` and `FilterControl[]`. Filtering, sorting, and paging happen in the database query, as in `listQueue()` in `src/apps/kyc/queries.ts`. See `src/apps/kyc/pages/queue-page.tsx`.
- Detail page: `DetailLayout` with `DetailSection` and `FieldList`, `StatusBadge` for statuses, `AuditHistory` from `src/platform/audit/audit-history.tsx` for the record's history. See `src/apps/kyc/pages/case-page.tsx`.
- Decisions: `DecisionPanel` with `DecisionOption[]`; options that need a reason open `ReasonDialog`. See `src/apps/kyc/components/case-decision-panel.tsx`.
- Every page component starts with `await requirePagePermission("<permission>")`, even though the shell already checked the tool permission.
- Only render action controls the user may use (call `can(user, ...)` and your `rules.ts`). Hiding a control is for usability; the server check is the real control.

## 7. Wrap every write in a permission check and an audit event

In `service.ts`, follow `claimCase()` and `approveCase()` in `src/apps/kyc/service.ts`:

```ts
export async function markRefundReviewed(user: Actor, id: string, note: string) {
  requirePermission(user, "refunds:request");
  return prisma.$transaction(async (tx) => {
    const before = await tx.refundRequest.findUnique({ where: { id } });
    if (!before) throw new NotFoundError(`Refund ${id} not found.`);
    if (!canReview(user, before)) throw new RuleError("This refund cannot be reviewed.");
    const after = await tx.refundRequest.update({ where: { id }, data: { status: "reviewed" } });
    await recordAudit(tx, { actor: user, action: "refund.review", recordType: RECORD_TYPE, recordId: id,
      before: { status: before.status }, after: { status: after.status }, reason: note });
    return after;
  });
}
```

In `actions.ts`, expose it with `secureAction({ permission, schema, record }, handler)` from `src/platform/rbac/guards.ts`. The Zod schema validates input; denials return 403 and write `auth.denied`. Throw `RuleError`, `NotFoundError`, or `ForbiddenError` from `src/platform/errors.ts` for rule failures, and call `revalidatePath()` after success.

## 8. Mask PII and route risky changes through approvals

- PII fields are listed in `PII_FIELDS` in `src/platform/pii/mask.ts`. If the tool has a new kind of PII (for example a bank account number), add it there with a mask function and a test in `tests/pii.test.ts`.
- Read records through a query that calls `maskRecord()`, as `getMaskedCase()` does. Never send raw PII to the client.
- `recordAudit()` masks `before`/`after` automatically, but do not put raw PII in `reason` or in logs.
- To show a value, use `MaskedField` with an `onReveal` server action that calls `revealPii(tx, { actor, field, value, recordType, recordId, reason })` inside a transaction. See `revealCaseField()` in `src/apps/kyc/service.ts`. `revealPii()` currently requires `kyc:reveal_pii`; if another permission should allow reveals in the new tool, add a `permission` parameter to `revealPii()` instead of granting the KYC permission.
- Anything that moves money or changes production goes through `src/platform/approvals`: call `requestApproval(tx, { requester, appId, recordType, recordId, summary, requiredPermission })` in the same transaction that moves the record to a pending status, and `decideApproval(tx, { approvalId, decider, decision, reason })` when a second person decides. The module enforces the required permission, the two-person rule, and a reason on rejection. Pending approvals appear on "My approvals" automatically, linked through `recordHref`.

## 9. Test

Add `tests/<tool-id>.test.ts` using the helpers in `tests/helpers.ts` (`ana`, `marcus`, `priya`, `sam`, `seedDatabase()`, `eventsFor()`). Cover:

- Permission denials: each role without the permission gets `ForbiddenError` from the service, and `secureAction` returns status 403 with an `auth.denied` event
- The main path: each allowed status change, with its audit event and masked before/after values
- Rule failures: invalid transitions, missing reasons, already-decided records
- Two-person rules: the requester cannot approve their own request, and a different person with the permission can
- Masking: detail queries return masked values, and a reveal writes `pii.reveal` without the value

## 10. Check everything

```
npm run db:reset
npm run lint
npm run typecheck
npm test
npm run dev
```

In the browser, sign in as each of the four users from the sign-in page and confirm: the tile appears only for users with the view permission, the URL returns 403 for others, each action works for the right role and is missing for the rest, PII is masked, approvals show up on "My approvals" for the second person, and the audit log shows every change. Run "Verify integrity" as Sam. Then open a pull request; CI runs the same checks on Ubuntu, macOS, and Windows.
