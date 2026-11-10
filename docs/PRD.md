# Internal tools platform: KYC review queue prototype

## Context

The company runs three internal tools on Microsoft Power Apps: a KYC review queue, a refunds dashboard, and a feature-flag admin panel. Licenses cost about $250K a year, and at least 10 more tools are planned. Engineering wants to know whether these tools can be built and owned in code instead, without weakening the controls compliance relies on.

This prototype tests that on the hardest of the three, the KYC review queue. It handles customer PII, requires two-person approval on high-risk cases, and produces the audit trail a regulator would review. The controls sit in a shared platform layer, so the next tools reuse them rather than rebuild them.

All data is fake, and none of this is production software.

## Goals

- Rebuild the KYC review queue with role-based access, PII masking, two-person approval, and a tamper-evident audit log
- Put those controls in a shared platform layer that any future tool can use
- Write down how to add the next tool, so Devin or an engineer can follow the same steps
- Run locally with three commands and no external services

## What it replaces in Power Apps

| Power Apps | This prototype |
| --- | --- |
| Entra ID sign-in | Demo sign-in behind one auth module, ready to swap for OIDC |
| Dataverse security roles | One permission map, checked on the server |
| Field-level security | PII masked by default, with a logged reveal |
| Dataverse auditing | Append-only audit log with a hash chain to detect tampering |
| Power Automate approvals | Shared approvals module that enforces a two-person rule |
| Model-driven views and forms | Shared table, detail layout, and decision panel |
| The app list | App registry that drives the home page and navigation |
| Solutions and pipelines | Git, pull requests, and CI |

## Out of scope

- Real single sign-on, real customer data, and real vendor integrations
- Hosting and deployment
- Building the refunds dashboard and the feature-flag admin panel, which appear on the home page as planned tools
- Notifications, migrating data from Dataverse, and mobile layouts

## Users and permissions

Seed four fake users. The sign-in page lists them so anyone can switch roles quickly.

| User | Role | Role in the demo |
| --- | --- | --- |
| Ana Lima | KYC Analyst | Claims cases, decides them, and gives the first approval on high-risk ones |
| Marcus Reed | Compliance Lead | Gives the second approval on high-risk cases and can reveal PII |
| Priya Shah | Support Agent | Has no KYC access, which shows the permission checks at work |
| Sam Park | Platform Admin | Reviews the audit log and checks its integrity |

Permissions are defined once in `src/platform/rbac` and must match this table.

| Permission | KYC Analyst | Compliance Lead | Support Agent | Platform Admin |
| --- | --- | --- | --- | --- |
| `kyc:view` | yes | yes | no | yes |
| `kyc:claim` | yes | yes | no | no |
| `kyc:decide` | yes | yes | no | no |
| `kyc:approve_high_risk` | no | yes | no | no |
| `kyc:reveal_pii` | no | yes | no | no |
| `audit:view` | no | yes | no | yes |
| `audit:verify` | no | no | no | yes |

## Platform requirements

Everything in this section lives in `src/platform` and is shared by every tool.

### Sign-in

- The sign-in page lists the four users with their roles, and selecting one starts a session
- Sessions use a signed, HTTP-only cookie
- Every page shows a banner that reads "Demo sign-in. Replace with OIDC (Okta or Entra ID) in production"
- All auth code lives in `src/platform/auth`, so real SSO can replace it without touching any tool

### Permissions

- `can(user, permission)` and `requirePermission(user, permission)` live in `src/platform/rbac`
- Every page load and every server action checks permissions on the server, even when the UI already hides the control
- A denied request returns a 403 page and is written to the audit log

### Audit log

- `recordAudit()` stores the actor, action, record type, record ID, before and after values, reason, and timestamp
- Each change and its audit event are written in the same database transaction
- No code path updates or deletes an audit event
- Each event stores the previous event's hash, and its own hash is a SHA-256 of that hash plus the event's canonical JSON
- `verifyAuditChain()` recomputes the chain and reports the first broken event, if there is one
- The audit page filters by actor, record, and date, and its "Verify integrity" button runs the check
- Audit events never contain unmasked PII

### PII masking

- SSN, date of birth, street address, and ID document number count as PII
- They display masked by default, such as `***-**-1234` for an SSN and `**/**/1990` for a date of birth
- Revealing a value requires `kyc:reveal_pii` and a typed reason, lasts for that page view only, and writes a `pii.reveal` audit event

### Approvals

- `requestApproval()` and `decideApproval()` live in `src/platform/approvals` and work for any tool
- The server rejects an approval from anyone who lacks the required permission or who made the request
- A rejection requires a reason
- A "My approvals" page lists every pending approval the signed-in user can act on

### App registry and shell

- Each tool registers its ID, name, description, path, icon, and required permission in `src/apps/registry.ts`
- The home page and sidebar are built from the registry and show only the tools the user can access
- The refunds dashboard and feature-flag admin panel are registered as planned and appear on the home page as tiles without links
- Adding a tool takes one folder and one registry entry, with no changes to the shell

### Shared components

- A data table with server-side filtering, sorting, search, and pagination
- A status badge, a record detail layout, a decision panel, and a reason dialog
- Tools use these components instead of building their own

## KYC review queue

### Data

- Each case has an ID, customer name, email, SSN, date of birth, address, country, ID document type and number, risk level, risk score, screening hits, status, assignee, created time, and SLA due time
- Risk level is Low, Medium, or High, and the risk score runs 0-100
- Screening hits are sanctions, politically exposed person, or adverse media matches, each with a match score
- Status is New, In review, Pending second approval, Approved, Rejected, or Escalated
- Seed 40 cases with a mix of risk levels, about a third with screening hits, and several that have missed their 48-hour SLA

### Queue page

- Filters cover status, risk level, and assignee (me, unassigned, or all), plus search by name or case ID
- Columns show case ID, customer, risk, status, assignee, age, and SLA, with breached SLAs in red
- Cases sort by SLA due time by default
- A Claim button assigns an unassigned case to the current user and moves it to In review

### Case page

- The customer profile shows PII masked, with a reveal control for users who have the permission
- The page shows ID documents (file names only), screening hits, and the risk score
- A history lists every audit event on the case
- A decision panel offers Approve, Reject, and Escalate

### Rules

- Analysts can decide only the cases they have claimed
- Approving a Low or Medium case sets it to Approved
- Approving a High case sets it to Pending second approval and creates an approval request that needs `kyc:approve_high_risk`
- The second approver must be a different person from the first
- Rejecting requires a reason code (document mismatch, sanctions match, incomplete, or other) and a note
- Escalating sets the case to Escalated and adds it to the Compliance Lead's view
- Every status change writes an audit event

### Acceptance criteria

- When Ana claims an unassigned case, it shows as hers with status In review, and the case history records the claim
- When Ana approves a High case, it moves to Pending second approval and appears in Marcus's "My approvals"
- When Ana calls the approval action directly on a case she decided, the server rejects it
- When Marcus approves that case, it moves to Approved, and the audit log shows both decisions
- Ana sees the SSN masked and has no reveal control
- When Marcus reveals the SSN with a reason, the audit log records a `pii.reveal` event with his name and reason but not the SSN
- Priya sees no KYC tile, and opening a KYC URL returns 403
- When an audit row is edited directly in the database, "Verify integrity" reports the broken event

## Technical approach

- Next.js (latest stable, App Router) with TypeScript in strict mode
- Prisma with SQLite, so the app needs no database server
- Tailwind CSS and shadcn/ui for the interface
- Zod validation on every form and server action
- Vitest unit tests for permissions, the two-person rule, the audit chain and tamper detection, masking, and KYC status changes
- A GitHub Actions workflow that runs lint, typecheck, and tests on Ubuntu, macOS, and Windows for every pull request
- No network calls at runtime
- Runs on macOS, Windows, and Linux with the current Node.js LTS release, so scripts use Node rather than shell-specific commands
- No manual setup beyond the three commands, with no `.env` file to copy and development defaults for the database path and session secret
- A `.gitattributes` file that keeps LF line endings, so lint passes on Windows

Folder layout:

```
src/
  platform/      auth, rbac, audit, approvals, pii, shared components
  apps/
    registry.ts  installed and planned tools
    kyc/         KYC review queue
prisma/
  schema.prisma
  seed.ts
.agents/skills/new-internal-tool/SKILL.md
AGENTS.md
README.md
docs/PRD.md
```

Scripts:

- `npm run db:reset` recreates the database and loads the seed data
- `npm run dev` starts the app at http://localhost:3000
- `npm test`, `npm run lint`, and `npm run typecheck` all pass with no errors

## Agent instructions

Two files tell Devin, or any coding agent, how to work in this repo.

`AGENTS.md` comes first and holds the rules every change follows:

- Check permissions on the server for every page and every write
- Write the audit event in the same transaction as the change
- Never display, log, or store unmasked PII outside the reveal flow
- Use fake data only
- Build each tool in `src/apps/<tool-id>` from the shared components and register it in `src/apps/registry.ts`
- Add tests for every new business rule

`.agents/skills/new-internal-tool/SKILL.md` comes last, once the KYC queue works. It is a step-by-step guide to adding the next tool. It uses this repo's real file paths and function names and is specific enough that someone could build the refunds dashboard from it with no other context. It covers:

- Listing open questions about the new tool before starting
- Adding Prisma models and seed data
- Adding permissions to the permission map and to the README's user table
- Registering the tool in the registry
- Building pages from the shared components
- Wrapping every write in a permission check and an audit event inside one transaction
- Masking PII and routing anything that moves money or changes production through the approvals module
- Testing permission denials, the main path, and two-person rules
- Running lint, typecheck, and tests, then checking the tool in the browser

## README

The README explains what the project does and how to run it. It should be concise, plainly written, and in this order:

1. Title and a two-sentence summary
2. One screenshot of the KYC queue, saved as `docs/kyc-queue.png`
3. Overview: the problem, the controls the prototype demonstrates, and the Power Apps mapping above as a short table
4. Getting started: prerequisites and the commands to install, set up the database, and run the app on macOS or Windows
5. Demo: the four users, what each can do, and the walkthrough below
6. Project structure: a short annotated folder tree
7. Testing: the test, lint, and typecheck commands
8. Adding a tool: how the registry and the Skill work together
9. Limitations and next steps, covering:
   - What is mocked today, such as sign-in and the seed data
   - What production would need, such as real SSO, Postgres with backups, a deployment pipeline, and a security review
   - The next tools to build with the Skill, starting with the feature-flag admin panel and then the refunds dashboard
   - Other additions worth making, such as notifications, a real screening vendor, and migrating cases from Dataverse

Write in short, specific sentences. Leave out emojis, badges, marketing language, and any account of how the repo was built.

## Demo walkthrough

Use these steps to check the build in the browser.

1. Sign in as Ana, filter to unassigned High-risk cases, and claim one
2. Open the case, note the masked SSN, review the screening hits, and approve it
3. Confirm the case is waiting for a second approval
4. Sign in as Marcus, open "My approvals," reveal the SSN with a reason, and approve
5. Open the case history to see both decisions and the reveal
6. Sign in as Priya and confirm that KYC is hidden and that its URL returns 403
7. Sign in as Sam, open the audit log, and run "Verify integrity"