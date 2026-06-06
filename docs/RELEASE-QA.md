<!-- last_verified: 2026-06-06 -->
# Release QA — Customer Handoff Gate

The checklist that defines "ready to hand to customers." Run it before tagging a
release or publishing the template. Every box must be checked (or have a logged,
accepted exception in `docs/exec-plans/tech-debt-tracker.md`).

The suite splits in two: a **credential-free** half that runs on every PR
(`ci.yml`), and a **live** half that needs a throwaway B2 bucket (`integration.yml`,
plus the manual walkthrough). A customer hits both — the code *and* the first-run
setup — so both must pass before handoff.

## 1. Automated suite (credential-free)

Mirrors `AGENTS.md §5`. Must be green locally and in CI.

- [ ] `pnpm install --frozen-lockfile` succeeds (lockfile in sync — no drift)
- [ ] `pnpm lint` (eslint) clean
- [ ] `pnpm build` (Next type-check + build) succeeds
- [ ] `pnpm lint:api` (ruff) clean
- [ ] `pnpm test:api` (pytest) green — integration tests report **skipped**, not failed
- [ ] `pnpm check:structure` green
- [ ] CI workflow `CI` is green on the release commit

One-liner for the backend gate:
```bash
pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure
```

## 2. Live integration (real throwaway B2 bucket)

Requires real creds in the repo-root `.env` (see `.env.example`). Use a
**disposable** test bucket — these tests create and delete objects.

- [ ] `pnpm test:api:integration` passes and leaves no residue (objects are
      written under `ci-int/<uuid>/` and cleaned up); without creds it **skips**
- [ ] `pnpm test:e2e` runs the full upload → preview → download → delete flow green
- [ ] CI workflow `Integration` is green on `main` (it provides secrets and runs
      both of the above)

> The e2e and `pnpm dev` both require a configured `.env` to boot (the API fails
> fast on missing creds, by design). If `pnpm test:e2e` can't start its server,
> the cause is almost always a missing/placeholder `.env`.

## 3. Onboarding walkthrough (the customer's first 10 minutes)

Do this in a **fresh** checkout — no inherited `.env`, `.venv`, or `node_modules` —
to reproduce exactly what a customer gets from "Use this template".

```bash
git clone <template-url> /tmp/vibe-smoke && cd /tmp/vibe-smoke
cp .env.example .env            # then edit .env with real B2 test-bucket creds
pnpm install
cd services/api && python3 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt && cd ../..
pnpm exec playwright install chromium   # first-time browser download for e2e
```

- [ ] `pnpm doctor` prints `✓ environment looks good`
- [ ] `pnpm dev` boots both servers; web reachable at http://localhost:3000
- [ ] In a second terminal, `pnpm smoke` exits 0 (health → metrics → upload →
      list → download → delete → stats all ✓)
- [ ] In the browser: upload a file → it appears on `/files` → preview shows
      metadata → download works → delete removes it → dashboard stats update
- [ ] The uploaded object actually appeared in the B2 bucket (B2 console or
      `aws s3 ls`) and is gone after delete

## 4. Docs accuracy & freshness

- [ ] README "Quick Start" steps reproduce on a clean machine (no missing step)
- [ ] README feature claims hold (dashboard, upload, file browser, `/metrics`)
- [ ] Every touched doc's `<!-- last_verified: YYYY-MM-DD -->` header is current
- [ ] Feature docs in `docs/features/` match actual behavior
- [ ] `.env.example` lists exactly the vars `doctor.mjs` and `main.py` require

## 5. Hygiene

- [ ] No secrets committed — `.env` is git-ignored (`git check-ignore .env` prints `.env`)
- [ ] `LICENSE` present
- [ ] pre-commit hooks intact (`.pre-commit-config.yaml`: ruff, large-file guard, etc.)
- [ ] No stray `print()` / debug code (ruff T20 covers backend)
- [ ] Open items triaged in `docs/exec-plans/tech-debt-tracker.md`
