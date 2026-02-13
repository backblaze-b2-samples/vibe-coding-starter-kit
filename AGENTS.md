# AGENTS.md

## 1. Repository Map

```
apps/web/          Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
services/api/      FastAPI backend (layered: types/config/repo/service/runtime)
packages/shared/   Shared TypeScript types
docs/              System of record (features, security, reliability, principles)
infra/railway/     Deployment config
plans/             Temporary reasoning artifacts (not source of truth)
```

## 2. Architectural Invariants

**Backend layering**: `types` -> `config` -> `repo` -> `service` -> `runtime`

- No backward imports across layers
- No `boto3` outside `repo/`
- No business logic in route handlers (`runtime/`)
- All external APIs wrapped in `repo/` adapters
- All request/response data validated at boundary (Pydantic models)
- No shared mutable state across layers

**Frontend**: shadcn/ui components in `src/components/ui/` are generated — never modify them.

## 3. Quality Expectations

- Structured JSON logging only — no `print()` statements
- No raw SDK calls outside `repo/` layer
- Files stay under 300 lines
- Tests added or updated for every behavior change
- Docs updated in same PR as code changes
- Lint clean before merge

## 4. Mechanical Enforcement

These rules are enforced by code, not convention:

| Rule | Enforced by |
|------|-------------|
| No backward imports | `tests/test_structure.py::test_no_backward_imports` |
| No boto3 outside repo/ | `tests/test_structure.py::test_boto3_only_in_repo` |
| File size < 300 lines | `tests/test_structure.py::test_file_size_limits` |
| All layers exist | `tests/test_structure.py::test_all_layers_exist` |
| No bare print() | `ruff` rule T20 |
| Import ordering | `ruff` rule I001 |
| Frontend strict equality | `eslint` rule eqeqeq |
| No unused vars | `eslint` + `ruff` rules |

Run: `pnpm check:structure` / `pnpm lint:api` / `pnpm lint`

## 5. Golden Principles

1. Prefer repository adapters over raw SDK usage
2. Validate all external input at boundaries
3. No implicit type assumptions — use typed models
4. Prefer boring, composable libraries over clever abstractions
5. Favor determinism — no `Math.random` in business logic
6. Do not rely on cultural memory — encode rules mechanically
7. Keep files small enough for agent context windows

Full list: [docs/golden-principles.md](docs/golden-principles.md)

## 6. Where to Find More Context

| Topic | Location |
|-------|----------|
| System layout, data flows, boundaries | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Security principles | [docs/SECURITY.md](docs/SECURITY.md) |
| Reliability expectations | [docs/RELIABILITY.md](docs/RELIABILITY.md) |
| Quality checklist | [docs/QUALITY_SCORE.md](docs/QUALITY_SCORE.md) |
| Feature specifications | [docs/features/](docs/features/) |
| User journeys | [docs/app-workflows.md](docs/app-workflows.md) |
| Engineering workflows | [docs/dev-workflows.md](docs/dev-workflows.md) |
| Execution plans | [docs/exec-plans/](docs/exec-plans/) |
| Design decisions | [docs/design-docs/](docs/design-docs/) |

## 7. When Unsure

- Prefer boring, stable libraries
- Prefer small PRs over large changes
- Add tests with every change
- Never bypass lint rules without explicit instruction
- If documentation and implementation conflict, update docs in the same PR
- Ask before making destructive or irreversible changes
