# AGENTS.md

Rules for Devin, or any coding agent or engineer, working in this repo. Every change follows them.

## Rules

1. **Check permissions on the server for every page and every write.** Pages call `requirePagePermission()`, server actions use `secureAction()`, and route handlers use `requireRouteUser()`/`requirePermission()` from `src/platform/rbac`. Hiding a button in the UI is never enough.
2. **Write the audit event in the same transaction as the change.** Call `recordAudit(tx, ...)` from `src/platform/audit` with the `tx` client inside `prisma.$transaction(async (tx) => ...)`. Never update or delete rows in `AuditEvent`.
3. **Never display, log, or store unmasked PII outside the reveal flow.** Use `maskPii()`/`maskRecord()` from `src/platform/pii`. Only `revealPii()` returns a raw value, and it writes a `pii.reveal` event. Audit `before`/`after` values are masked automatically, but do not pass raw PII to logs or the client.
4. **Use fake data only.** Seeds use made-up names, `example.com` emails, and invented numbers.
5. **Build each tool in `src/apps/<tool-id>` from the shared components and register it in `src/apps/registry.ts`.** Use `DataTable`, `StatusBadge`, `DetailLayout`, `DecisionPanel`, and `ReasonDialog` from `src/platform/components`. Do not change the shell to add a tool.
6. **Add tests for every new business rule.** Put them in `tests/` and run them with `npm test`.

## Commands

- `npm install` installs dependencies
- `npm run db:reset` recreates the SQLite database and loads the seed
- `npm run dev` starts the app at http://localhost:3000
- `npm test`, `npm run lint`, and `npm run typecheck` must all pass before a pull request

## Conventions

- TypeScript strict mode. Validate every form and server action input with Zod.
- Scripts must run on macOS, Windows, and Linux, so write them in Node, not shell.
- Permissions are defined once in `src/platform/rbac/permissions.ts` and must match the table in `docs/PRD.md` and `README.md`.
- To add a tool, follow `.agents/skills/new-internal-tool/SKILL.md`.
