# Dev Workflows

## New Feature

- [ ] Create plan in `plans/YYYY-MM-DD-short-title.md`
- [ ] Implement feature
- [ ] Add/update tests (when test harness exists)
- [ ] Update `docs/features/<feature>.md`
- [ ] Update `docs/app-workflows.md` if user flow changes
- [ ] Update `ARCHITECTURE.md` if system boundary changes
- [ ] Update `README.md` if setup or scope changes
- [ ] Run `pnpm build` and `pnpm lint`
- [ ] Submit PR

## Bugfix

- [ ] Add failing test first (when test harness exists)
- [ ] Confirm failure
- [ ] Implement fix
- [ ] Rerun tests until green
- [ ] Update docs if behavior changed
- [ ] Submit PR

## Refactor

- [ ] Create plan if multi-file
- [ ] Implement refactor
- [ ] Run full test suite
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
- E2E: highest-value user workflows only

### Test Placement
- Frontend: `apps/web/__tests__/` (when created)
- Backend: `services/api/tests/` (when created)

### Commands
- Lint: `pnpm lint`
- Build: `pnpm build`
- Backend: `cd services/api && pytest` (when test harness exists)

### When to Run
- After behavior change: run relevant subset
- Before PR: run full suite or document why not
