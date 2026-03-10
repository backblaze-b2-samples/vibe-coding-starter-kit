<!-- last_verified: 2026-03-10 -->
# CLAUDE.md

Follow [AGENTS.md](AGENTS.md) at all times — it is the single source of truth.

## Doc Read Order
1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `docs/features/<feature>.md` (if applicable)
4. `docs/app-workflows.md`
5. `docs/dev-workflows.md`

## Plans
- Create in `docs/exec-plans/active/`
- Move to `docs/exec-plans/completed/` after validation

## Test Commands
- Quick: `pnpm test:api`
- Full: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`

## Diff Discipline
- Update docs in the same PR as code changes
- Only change files relevant to the task
