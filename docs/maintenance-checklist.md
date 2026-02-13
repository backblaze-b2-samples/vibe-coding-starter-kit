# Maintenance Checklist

Periodic tasks to keep the codebase healthy. Run weekly or before major releases.

## Lint Drift Detection

- [ ] `pnpm lint` — frontend ESLint passes with zero warnings
- [ ] `pnpm lint:api` — backend ruff passes with zero violations
- [ ] Check for new ruff rules that should be enabled

## Dead Code Detection

- [ ] Search for unused imports: `ruff check . --select F401`
- [ ] Search for unused variables: `ruff check . --select F841`
- [ ] Review exports in `__init__.py` files — remove unused re-exports

## Boundary Violation Scanning

- [ ] `pnpm check:structure` — all structural tests pass
- [ ] Verify no `boto3` imports outside `app/repo/`
- [ ] Verify no backward imports across layers
- [ ] Verify no `print()` statements in production code

## File Size Enforcement

- [ ] No Python file exceeds 300 lines
- [ ] No TypeScript file exceeds 400 lines
- [ ] Split files that are approaching limits

## Dependency Hygiene

- [ ] `pip list --outdated` — check for outdated Python packages
- [ ] `pnpm outdated` — check for outdated Node packages
- [ ] Review and update pinned versions in requirements.txt and package.json

## Doc Freshness

- [ ] ARCHITECTURE.md reflects current system layout
- [ ] AGENTS.md test commands match actual available commands
- [ ] Feature docs match current behavior
- [ ] README.md setup instructions work on a fresh clone

## Security

- [ ] No secrets in source code (`git log --diff-filter=A -p -- '*.env'`)
- [ ] Dependencies scanned for known vulnerabilities
- [ ] CORS origins restricted to expected domains
