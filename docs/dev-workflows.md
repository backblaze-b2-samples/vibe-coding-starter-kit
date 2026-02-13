# Dev Workflows

## New Feature

- [ ] Create plan in `plans/YYYY-MM-DD-short-title.md`
- [ ] Implement feature (respect layering: types -> config -> repo -> service -> runtime)
- [ ] Add/update tests
- [ ] Update `docs/features/<feature>.md`
- [ ] Update `docs/app-workflows.md` if user flow changes
- [ ] Update `ARCHITECTURE.md` if system boundary changes
- [ ] Update `README.md` if setup or scope changes
- [ ] Run `pnpm build`, `pnpm lint`, `pnpm lint:api`, `pnpm test:api`
- [ ] Submit PR

## Bugfix

- [ ] Add failing test first
- [ ] Confirm failure
- [ ] Implement fix
- [ ] Rerun tests until green
- [ ] Update docs if behavior changed
- [ ] Submit PR

## Refactor

- [ ] Create plan if multi-file
- [ ] Implement refactor
- [ ] Run full test suite (`pnpm test:api`, `pnpm check:structure`)
- [ ] Verify no behavior change (or update docs if intentional)
- [ ] Submit PR

## Documentation Update

- [ ] Identify correct canonical file per doc update mapping in `AGENTS.md`
- [ ] Update only affected sections
- [ ] Verify cross-links
- [ ] Submit PR

## Pull Request

- [ ] Summary of changes
- [ ] Link feature docs (if applicable)
- [ ] List tests run (subset + full)
- [ ] List docs updated
- [ ] Note risks / assumptions
- [ ] Include manual validation steps
- [ ] Reference plan (if used)

## Testing

### Test Types
- Unit: pure logic
- Integration: boundaries (HTTP handlers, external API calls)
- Structural: layering rules, import boundaries, file size limits
- E2E: highest-value user workflows only

### Test Placement
- Frontend: `apps/web/e2e/` (Playwright)
- Backend: `services/api/tests/`

### Commands
```bash
pnpm lint              # frontend lint
pnpm build             # frontend build
pnpm lint:api          # backend lint (ruff)
pnpm test:api          # backend tests (pytest)
pnpm check:structure   # structural boundary tests
pnpm test:e2e          # Playwright e2e tests
```

### When to Run
- After behavior change: run relevant subset
- Before PR: run full suite or document why not
