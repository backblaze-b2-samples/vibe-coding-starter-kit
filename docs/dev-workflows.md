<!-- last_verified: 2026-08-06 -->
# Dev Workflows

Engineering workflows for this repo.

## New Feature

- [ ] Read `AGENTS.md` and `ARCHITECTURE.md`
- [ ] Read the relevant feature doc in `docs/features/`
- [ ] For non-trivial changes, create a plan in `docs/exec-plans/active/`
- [ ] Implement the smallest coherent change
- [ ] Add or update tests
- [ ] Run: `pnpm verify`
- [ ] Update docs in the same PR (see AGENTS.md §9)
- [ ] Move plan to `docs/exec-plans/completed/` after validation

## Bugfix

- [ ] Add a failing test that reproduces the bug
- [ ] Confirm the test fails
- [ ] Implement the fix
- [ ] Rerun tests until green
- [ ] Update docs if behavior changed

## Refactor

- [ ] Read `ARCHITECTURE.md` — respect layering rules
- [ ] Ensure structural tests still pass: `pnpm check:structure`
- [ ] No behavior changes without updating feature docs

## Documentation Update

- [ ] Update only the canonical location (see AGENTS.md §9 doc update mapping)
- [ ] Never duplicate content — link instead
- [ ] Update `<!-- last_verified: YYYY-MM-DD -->` header

## Pull Request

- [ ] One coherent change per PR
- [ ] Run `pnpm verify` before submitting
- [ ] Docs updated in the same PR as code changes
- [ ] Only change files relevant to the task — no drive-by improvements

GitHub surfaces this contract automatically through two templates, so reviewers
see it without opening this file:

- `.github/PULL_REQUEST_TEMPLATE.md` — prefills every PR with scope, a
  verification table, skipped-check explanations, UI evidence, docs, and
  risk/rollback.
- `.github/ISSUE_TEMPLATE/coding-agent-handoff.md` — prefills a scoped
  implementation request with the context a coding agent needs.

The templates are prompts for evidence, not a second rulebook: the rules live in
`AGENTS.md` and in this file. Keep them thin and link back here rather than
restating a rule in template prose, where it would be copied verbatim into every
future issue and PR body and could never be corrected retroactively.

### Review ownership

This starter kit has no `CODEOWNERS` file, so GitHub assigns no reviewer
automatically — request one manually. This is the canonical statement of that
status: if `CODEOWNERS` is ever added, update this section, and the templates
that point here stay correct without edits.

## Testing

### Local environments

Supported local development environments are macOS, Linux, and WSL2. Native
Windows is not supported yet because the package scripts use POSIX shell syntax
and `services/api/.venv/bin/*` paths; use WSL2 on Windows.

Run `pnpm run setup` on a fresh clone. It is idempotent: it copies
`.env.example` to `.env` only if `.env` does not already exist (first, because it
is the only step that needs no network), installs workspace dependencies from
`pnpm-lock.yaml`, creates `services/api/.venv` only when missing, validates an
existing venv uses Python 3.12+, and installs the committed Python 3.12
resolution in `services/api/requirements.lock`. It installs Node dependencies
with `--frozen-lockfile`, so run `pnpm install` yourself after editing
`package.json`.

`setup` and `doctor` must always be invoked as `pnpm run setup` / `pnpm run
doctor`. Both are built-in pnpm commands before pnpm 11 (the version CI pins and
the minimum `engines` allows), and the bare `pnpm setup` / `pnpm doctor` forms
run pnpm's own commands — `pnpm setup` silently edits your shell profile instead
of preparing the repo. `predev` and `verify:full` therefore use the `run` form
too, and `pnpm check:agent-docs` asserts it.

Cloud or sandboxed agents need network permission for dependency downloads
during `pnpm run setup`. Dev and E2E runs also need localhost server binding:
Next.js uses port 3000, and the API uses 8000-8009 via `scripts/pick-port.mjs`.
Playwright E2E additionally needs permission to launch its Chromium browser. If
binding is denied by the sandbox, `pnpm run doctor` and `scripts/pick-port.mjs`
report `EPERM`/`EACCES` with a local-server permission fix instead of treating
the port as free or exhausted. A missing IPv6 stack is reported as neither: the
`::`/`::1` probe answers `EAFNOSUPPORT`/`EADDRNOTAVAIL`, which both scripts
ignore so an IPv6-less container still starts. Doctor also probes the two
wildcards one after the other, because a dual-stack `::` bind on Linux collides
with a concurrently held `0.0.0.0` bind and would report a free port as busy.

### Test types
- **Unit**: pure logic (service layer)
- **Integration**: HTTP handlers, B2 connectivity (`tests/`)
- **Structural**: layering rules, import boundaries (`tests/test_structure.py`)
- **Contract**: checked-in OpenAPI artifact and frontend route drift
- **E2E**: Playwright browser-driven smoke tests

### Test placement
- Backend: `services/api/tests/`
- E2E: `apps/web/e2e/` with config in `apps/web/playwright.config.ts`

### Commands
- Agent docs health: `pnpm check:agent-docs`
- Cold-start setup: `pnpm run setup`
- Preflight environment check: `pnpm run doctor`
- API contract export: `pnpm contract:export`
- API contract drift check: `pnpm contract:check`
- Canonical pre-PR suite: `pnpm verify`
- Backend half only: `pnpm verify:api`
- Frontend half only: `pnpm verify:web`
- Full local suite: `pnpm verify:full`
- Quick (backend): `pnpm test:api`
- Frontend unit: `pnpm test:web` (vitest, excludes e2e)
- Structure: `pnpm check:structure`
- Frontend typecheck: `pnpm typecheck`
- Frontend lint: `pnpm lint`
- Backend lint: `pnpm lint:api`
- E2E: `pnpm test:e2e` (run `pnpm --filter @vibe-coding-starter-kit/web exec playwright install chromium` once first)

### Pre-commit

The tracked [`.pre-commit-config.yaml`](../.pre-commit-config.yaml) is an
optional local guard for staged changes; CI remains the required enforcement
path. Install the `pre-commit` command with your preferred isolated Python tool
(for example, `pipx install pre-commit`), then enable the hooks so they run
against staged changes on each commit:

```bash
pre-commit install
pre-commit run            # check currently staged files
```

Run `pre-commit validate-config` after editing the configuration. The hooks
include staged-change secret detection, Ruff checks for API files, and small
repository hygiene checks. They do not replace `pnpm verify`. A full-tree
`pre-commit run --all-files` scan is optional: `detect-secrets` ships without a
committed `.secrets.baseline`, so expect it to surface pre-existing high-entropy
strings (for example, the example-key patterns in docs) to triage rather than a
clean pass.

### API Contract

The checked-in FastAPI contract lives at `docs/api/openapi.json`. Refresh it
with `pnpm contract:export` after changing route declarations, response models,
or request models. The exporter imports `services/api/main.py`, calls
`app.openapi()`, and writes sorted, indented JSON so diffs stay deterministic.
Both contract commands run `services/api/.venv/bin/python`, so they need
`pnpm run setup` first.

The comparison is byte-exact. The complete Python 3.12 resolution is committed
in `services/api/requirements.lock`, so routine verification must not fail
merely because FastAPI or Pydantic published a release. If an intentional
dependency refresh changes schema generation, refresh and review the lock and
contract in the same PR as described below.

Run `pnpm contract:check` for a fast API/client drift check. It verifies that
`docs/api/openapi.json` matches the generated FastAPI contract, then runs the
frontend contract test that compares `API_CLIENT_ROUTES` in
`apps/web/src/lib/api-client.ts` against the artifact. `GET /metrics` is the
only current server-only operation; add future backend-only routes to that test
deliberately rather than letting them pass unnoticed.

`pnpm verify` catches the same drift without a separate command: `pnpm test:api`
includes the OpenAPI freshness test, and `pnpm test:web` includes the frontend
route-contract test. This is intentionally a lightweight hand-written workflow;
do not add full OpenAPI codegen until this first contract check proves
insufficient.

Scope: the check covers **routes** (path + verb), not payloads. Response and
request *shapes* — and the hand-written mirrors of the Pydantic models in
`packages/shared/src/types.ts` — are still synced by hand and unverified. See
the tech-debt tracker.

### Python dependency updates

`services/api/requirements.txt` is the human-edited input and
`services/api/requirements.lock` is the complete exact-version Python 3.12
resolution used by setup and CI. Do not edit the lock for routine feature work.

The lock is resolved for CPython 3.12 on Linux/macOS and its pins carry no
environment markers, so Windows is not a supported setup target (for example,
`uvloop` ships no Windows wheels). If Windows support is ever required,
regenerate the lock with a marker-preserving tool such as pip-tools'
`pip-compile` instead of `pip freeze`.

When deliberately adding or updating an API dependency:

1. Edit `services/api/requirements.txt` and use a clean Python 3.12 virtual
   environment outside the repository (for example, under `/tmp`).
2. Install `requirements.txt` in that environment, run `python -m pip freeze`,
   and replace `requirements.lock` with the exact application, test, and quality
   packages. Omit bootstrap tools such as `pip` and `setuptools`.
3. Recreate the repository venv with `pnpm run setup`, run
   `pnpm contract:export`, and review any contract diff. Commit the input, lock,
   and contract together only when the change is intended.
4. Run `pnpm contract:check` and `pnpm verify`. If a contract change is
   unexpected, restore the prior input/lock instead of accepting generated
   OpenAPI churn.

If a fresh clone fails dependency installation, first confirm that
`services/api/requirements.lock` is present and rerun `pnpm run setup`; do not
run an unconstrained install from `requirements.txt` as a recovery shortcut.

`pnpm check:agent-docs` validates the canonical `AGENTS.md` surface, including
its instruction-trust boundary, thin cross-agent shims, command docs, CI claims,
and `.env` ignore coverage
(`scripts/check-agent-docs.mjs`, helpers in `scripts/agent-docs/`). It is
dependency-free by design — it runs without `pnpm install`, which is why its CI
job skips the install step. Register every new agent shim there so it can't be
emptied or unlinked from `AGENTS.md` unnoticed (see AGENTS.md §9). A file that
is missing *or* empty fails its own assertion rather than skipping the group it
belongs to.

Two rules about the secret-handling section are worth knowing before editing it:
the rule must read as a prohibition (a sentence naming `.env`, credentials, keys
or a leak surface only counts when the same sentence forbids something), and
[SECURITY.md](SECURITY.md#agent-security-rules) must point at that heading with
an anchored link whose target really exists. Renumbering the section therefore
fails the check — fix the link in the same change rather than leaving a
hyperlink that quietly lands the reader at the top of `AGENTS.md`.

The `.env` ignore group asks git which repo-tracked `.gitignore` rule matches
each path (global excludes and `.git/info/exclude` don't count). Each path is
asked independently: one that git cannot answer for (say a symlinked
`apps/web/`) is reported as its own `SKIPPED: .env ignore check for <path>
(...)` line while every other path is still checked and can still fail the run.
Only when *no* path is answerable — outside a git work tree, for instance — is
the whole group abandoned with a single `SKIPPED: .env ignore checks (...)`
notice. Skipped checks are never counted as passes and never fail the run.
Example/template env files must stay trackable anywhere in the tree;
`apps/web/.gitignore` overrides the root one for `apps/web/**`, so its negations
live there too.

### Non-live verification

`pnpm verify` is the canonical credential-free non-live gate for PRs. It is composed of
`pnpm check:agent-docs`, then `pnpm verify:api` (backend lint, backend tests,
structural boundary tests), then `pnpm verify:web` (frontend lint, frontend
unit tests, frontend typecheck + build) — so the agent-doc guard runs first and
CI can run all three checks as parallel jobs. `package.json` is the single
source of truth for the literal command chain; when it changes, update the
plain-language list here and in `AGENTS.md` §6 (see "Documentation Update"
above), not a duplicated shell chain.

Normal API tests deny socket connections and mock the B2 boundary in `/health`,
so a populated developer `.env` cannot turn this gate into a live service test.
To intentionally validate real connectivity with approved non-production
credentials, run `RUN_LIVE_B2_TESTS=1 pnpm test:live:b2`. Without that explicit
flag the live test skips, and it is never part of `pnpm verify` or CI.

The commands are deliberately composable: use the smaller commands while
iterating, `pnpm verify` as the usual PR gate, and `pnpm verify:full` only when
the live local prerequisites are available.

```text
pnpm verify:full
├─ pnpm run doctor
├─ pnpm verify
│  ├─ pnpm check:agent-docs
│  ├─ pnpm verify:api
│  │  ├─ pnpm lint:api
│  │  ├─ pnpm test:api
│  │  └─ pnpm check:structure
│  └─ pnpm verify:web
│     ├─ pnpm lint
│     ├─ pnpm test:web
│     └─ pnpm build
└─ pnpm test:e2e
```

One checkout supports one active `pnpm verify`: concurrent Next.js builds
contend for `apps/web/.next/lock`. For parallel agents, give each run its own
Git worktree checked out at the commit it needs to verify, then run setup and
verification inside that worktree:

```bash
git worktree add <path> <target-commit>   # e.g. HEAD to verify your current branch
cd <path>
pnpm run setup
pnpm verify
git worktree remove <path>                 # remove the worktree when done
```

This is also the recovery path for shared-checkout contention. If a terminated
run leaves `.next/lock`, first confirm no `next build` or `pnpm verify` process
is active, remove only `apps/web/.next/lock`, then rerun `pnpm verify` (or move
the work to a separate worktree). Do not delete the whole `.next` directory as
routine recovery.

On a warm development machine, plan for about 30 seconds for `pnpm verify`.
The first run after setup or a dependency/cache change can take longer. If an
unchanged warm checkout takes more than two minutes, rerun `pnpm verify` once;
if it remains slow, run `pnpm verify:api` and `pnpm verify:web` separately
(not concurrently in the same checkout) to locate the slow half. Do not switch
to `pnpm verify:full` as a recovery step: it is a separate live workflow.

`pnpm verify:full` runs `pnpm run doctor` first (it fails fast on a missing venv,
missing `.env`, or placeholder credentials, before the long suite starts), then
`pnpm verify`, then `pnpm test:e2e`. Use it when live local prerequisites are
available:

- root `.env` contains real B2 credentials
- the backend virtualenv `services/api/.venv` exists
- local server binding is permitted
- port 3000 is free, or already serving this app
- Playwright Chromium has been installed

This live E2E behavior is intentionally separate from `pnpm verify`: the
non-live gate neither starts a server nor allocates a port. Playwright starts
`pnpm dev` from `apps/web/playwright.config.ts` and waits on
`http://localhost:3000`. Note that `next dev` falls back to the next free port
when 3000 is taken, so an unrelated process on 3000 makes `pnpm test:e2e` time
out waiting on a URL the app never claimed — `pnpm run doctor` warns about this
but does not fail. The API starts at `localhost:8000` or the next free port chosen
by `scripts/dev.sh`.

`e2e/**` and `playwright.config.ts` are excluded from `apps/web/tsconfig.json`,
so no gate in `pnpm verify` typechecks them; type errors there only surface
when `pnpm test:e2e` runs.

### When to run
- After behavior change: run relevant subset
- Before PR: run `pnpm verify`
- Before PRs that affect browser flows or live-service behavior: run
  `pnpm verify:full` when the prerequisites above are available

### Continuous Integration
- `.github/workflows/ci.yml` runs `pnpm check:agent-docs` plus the two halves
  of `pnpm verify` — `pnpm verify:api` and `pnpm verify:web` — as parallel jobs
  on every PR and push to `main`. Same gates as running `pnpm verify` locally,
  but they report independently, so a frontend failure never hides a backend
  failure.
- No secrets required — backend tests deny socket access and mock the B2 repo
  layer, including explicit healthy/degraded `/health` cases. `pnpm verify:full`
  and E2E are not in CI
  because they need a running app, browser install, and live B2 credentials.
- The workflow declares `permissions: contents: read` at the top level, so
  `GITHUB_TOKEN` is read-only for every job. Keep it that way; if a new job
  genuinely needs to write (publish annotations, comment on a PR), add a
  narrower job-level `permissions` block rather than widening the top-level
  one. See [SECURITY.md](SECURITY.md#ci-permissions).

## Frontend Conventions

- Tailwind v4: config via CSS `@theme` blocks, NOT `tailwind.config.ts`
- Colors: hex design tokens (GitHub Primer palette) in
  `apps/web/src/app/globals.css`. Use via Tailwind utilities (`bg-primary`,
  `text-muted-foreground`) or `var(--token)`. Restyle by editing tokens, not
  component classes.
- Dark mode: `next-themes` with `@custom-variant dark (&:is(.dark *))`
- Animations: `tw-animate-css` (not `tailwindcss-animate`)
- shadcn/ui components in `src/components/ui/` are generated — never modify
  them. To extend one (e.g. give a dialog action a variant), wrap it or pass
  `buttonVariants()` / classes at the call site instead of editing the file.

**Design system:** the full token + primitive catalog lives in
[design-system.md](design-system.md), with a live reference at the `/design`
route. Build new screens from these primitives and tokens — don't hand-roll.

### Building a screen

1. Page shell: a `page-title` heading + one-line `text-muted-foreground`
   description, then content stacked with `space-y-*`.
2. Group content in `Card` (`components/ui/card`); use `Section` for labelled
   groupings on reference pages.
3. Fetch through a `queries.ts` hook (see Data Fetching below) — never bare
   `useEffect + fetch`.
4. Cover every state: `Skeleton` while loading, `EmptyState` when there's no
   data, `<ErrorState error={error} onRetry={...} />` on fetch failure.
5. Style through tokens (`bg-*`, `text-*`, `var(--token)`) — no hex literals.

## Data Fetching

All API reads/writes flow through TanStack Query hooks in
`apps/web/src/lib/queries.ts`. Don't add bare `useEffect + fetch` patterns
to components.

**Read** — use the hooks directly:

```tsx
const { data, isLoading, error, refetch } = useFiles(prefix, limit);
const { data: stats } = useFileStats();
```

Surface errors via `<ErrorState error={error} onRetry={() => refetch()} />`
rather than silently rendering empty UI.

**Write** — wrap mutations with `useMutation` and invalidate on success:

```tsx
const deleteMutation = useDeleteFile();
deleteMutation.mutate(file.key, {
  onSuccess: () => toast.success("Deleted"),
});
```

`useDeleteFile()` already calls `queryClient.invalidateQueries({ queryKey: qk.all })`
on success — every consumer of `useFiles` / `useFileStats` re-fetches lazily.

**Add or change an endpoint** — follow the matching column:

| Required surface | Frontend-consumed | Backend-only |
| --- | --- | --- |
| `services/api/app/runtime/<router>.py` FastAPI route | Yes | Yes |
| `apps/web/src/lib/api-client.ts` wrapper + `API_CLIENT_ROUTES` | Yes | No |
| `apps/web/src/lib/queries.ts` hook + `qk` entry | Yes | No |
| `docs/api/openapi.json` via `pnpm contract:export` | Yes | Yes |
| `SERVER_ONLY_OPERATIONS` in `apps/web/src/lib/api-contract.test.ts` | No | Yes |
| Relevant `docs/features/<feature>.md` behavior | Yes | Yes |

Run `pnpm contract:check` after the export, then finish with `pnpm verify`.

Defaults (in `apps/web/src/lib/query-client.tsx`):
- `staleTime: 30s` — file lists / stats don't change second-to-second
- `retry: 1` for transient errors; never retry 4xx (won't get better)
- `refetchOnWindowFocus`: on (TanStack default) — dashboard self-heals
  when the user comes back to the tab
