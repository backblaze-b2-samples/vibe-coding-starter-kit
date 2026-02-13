# CLAUDE.md

## Agent Workflow

1. Read [AGENTS.md](AGENTS.md) first — it is the authoritative control surface.
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) before making structural changes.
3. For non-trivial changes, create an execution plan in `docs/exec-plans/` or `plans/YYYY-MM-DD-short-title.md`.
4. Implement the smallest coherent change.
5. Run lint + tests: `pnpm lint`, `pnpm lint:api`, `pnpm test:api`, `pnpm check:structure`.
6. Validate API layer boundaries are respected.
7. Open PR with clear intent and acceptance criteria.

## Self-Validation Checklist

Before submitting any change, verify:

- [ ] Does this violate layer direction? (types -> config -> repo -> service -> runtime)
- [ ] Are all boundary inputs validated with Pydantic models?
- [ ] Are logs structured JSON? (no `print()`)
- [ ] Are tests added or updated for the behavior change?
- [ ] Does this duplicate an existing abstraction?
- [ ] Are files under 300 lines?
- [ ] Are docs updated in this same PR?

## Test Commands

```bash
pnpm lint              # frontend lint
pnpm build             # frontend type check + build
pnpm lint:api          # backend lint (ruff)
pnpm test:api          # backend tests (pytest)
pnpm check:structure   # structural boundary tests
pnpm test:e2e          # Playwright e2e tests
```

## Run Commands

```bash
pnpm dev               # start both frontend and backend
pnpm dev:web           # frontend only
pnpm dev:api           # backend only
```

## Merge Philosophy

- Small PRs preferred over large changes.
- Fix-forward rather than block indefinitely.
- Mechanical enforcement > stylistic preference.
- Never weaken tests or lint rules without explicit instruction.

## Diff Discipline

- Only change files relevant to the task.
- Do not modify generated shadcn/ui components in `src/components/ui/`.
- Do not add features, refactor code, or make "improvements" beyond what was asked.

## Freshness Rule

If documentation and implementation conflict:
- Update documentation in the same PR.
- Do not allow drift.
- Documentation rot destroys agent reliability.

## Doc Update Mapping

| Change Type | Update Location |
|-------------|-----------------|
| Feature logic, inputs, outputs | `docs/features/<feature>.md` |
| User journeys | `docs/app-workflows.md` |
| System layout, deployments | `ARCHITECTURE.md` |
| Dev or testing process | `docs/dev-workflows.md` |
| Setup or scope changes | `README.md` |
| Security changes | `docs/SECURITY.md` |
| Reliability changes | `docs/RELIABILITY.md` |

## Frontend Conventions

- Tailwind v4: config via CSS `@theme` blocks, NOT `tailwind.config.ts`
- Colors: OKLch format
- Dark mode: `next-themes` with `@custom-variant dark (&:is(.dark *))`
- Animations: `tw-animate-css` (not `tailwindcss-animate`)
