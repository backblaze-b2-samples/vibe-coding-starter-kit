# Agent Rules

## Project Conventions

### Structure
- Monorepo: pnpm workspaces (`apps/*`, `packages/*`)
- Frontend: `apps/web/` — Next.js 15, App Router, Tailwind v4, shadcn/ui
- Backend: `services/api/` — FastAPI, boto3 for B2 S3
- Shared types: `packages/shared/`

### Frontend
- Tailwind v4: config via CSS `@theme` blocks, NOT `tailwind.config.ts`
- Colors: OKLch format
- Dark mode: `next-themes` with `@custom-variant dark (&:is(.dark *))`
- Components: shadcn/ui — do not modify generated component files in `src/components/ui/`
- Animations: `tw-animate-css` (not `tailwindcss-animate`)

### Backend
- Python 3.11+, FastAPI
- boto3 with `signature_version=s3v4` for B2 S3
- Pydantic v2 for models and settings
- Config loaded via `pydantic-settings` from environment

## Documentation Rules

- Docs MUST be updated in the same PR as code changes
- New doc files MUST NOT be created unless explicitly instructed
- Feature behavior changes → `docs/features/<feature>.md`
- User flow changes → `docs/app-workflows.md`
- System boundary changes → `ARCHITECTURE.md`
- Dev or testing process changes → `docs/dev-workflows.md`
- Setup or scope changes → `README.md`

## Doc Update Mapping

| Change Type | Update Location |
|-------------|-----------------|
| Feature logic, inputs, outputs, tests | `docs/features/<feature>.md` |
| User journeys | `docs/app-workflows.md` |
| System layout, deployments, integrations | `ARCHITECTURE.md` |
| Dev or testing process | `docs/dev-workflows.md` |
| Setup or tech stack summary | `README.md` |
| Temporary reasoning | `plans/` |

## Planning Rules

- Multi-file changes require a plan written to `plans/`
- Plans are temporary — never a source of truth
- Plans are referenced in PRs, optional to keep post-merge

## Testing Rules

- Tests MUST be added or updated for any behavior change
- Tests MUST NOT be weakened or bypassed unless explicitly instructed
- Relevant test subset MUST run after changes
- Full test suite MUST run before PR (or reason documented)

### TDD Guidance

- Agents SHOULD use TDD when: behavior is well-defined, a bug is reproducible, core logic is touched
- Agents MAY implement first when: work is UI-only, behavior is exploratory, no test harness exists

### Test Commands

- Frontend lint: `pnpm lint`
- Full build check: `pnpm build`
- Backend (when test harness exists): `cd services/api && pytest`
- No test suites exist yet — test harness setup is pending

### Bugfix Rule

1. Add failing test first
2. Confirm failure
3. Implement fix
4. Rerun tests until green

## Pull Request Requirements

All changes MUST be submitted via PR with:

- Summary
- Feature doc links (if applicable)
- Tests run (subset + full)
- Docs updated (explicit list)
- Risks / assumptions
- Manual validation steps
- Plan reference (if used)

## Run Commands

- `pnpm dev` — start both frontend and backend
- `pnpm dev:web` — frontend only
- `pnpm dev:api` — backend only
- `pnpm build` — build frontend
- `pnpm lint` — lint frontend
- `cd services/api && uvicorn main:app --reload` — backend directly
