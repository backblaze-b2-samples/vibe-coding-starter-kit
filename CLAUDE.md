# Claude Code Config

Follow [AGENTS.md](AGENTS.md) at all times.

## Doc Read Order

1. README.md
2. ARCHITECTURE.md
3. docs/features/<feature>.md (if applicable)
4. docs/app-workflows.md
5. docs/dev-workflows.md
6. AGENTS.md
7. CLAUDE.md

## Plans

Write to `plans/YYYY-MM-DD-short-title.md`.

## Test Commands

- `pnpm lint` — lint frontend
- `pnpm build` — type check + build
- `cd services/api && pytest` — backend (when harness exists)

## Diff Discipline

- Only change files relevant to the task
- Do not modify generated shadcn/ui components in `src/components/ui/`
- Docs MUST be updated in the same PR as code changes
