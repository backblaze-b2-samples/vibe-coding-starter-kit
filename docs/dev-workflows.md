<!-- last_verified: 2026-07-27 -->
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

## Testing

### Test types
- **Unit**: pure logic (service layer)
- **Integration**: HTTP handlers, B2 connectivity (`tests/`)
- **Structural**: layering rules, import boundaries (`tests/test_structure.py`)
- **E2E**: Playwright browser-driven smoke tests

### Test placement
- Backend: `services/api/tests/`
- E2E: `apps/web/e2e/` with config in `apps/web/playwright.config.ts`

### Commands
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

`pnpm verify` is the canonical non-live gate for PRs. It is composed of two
halves — `pnpm verify:api` (backend lint, backend tests, structural boundary
tests) then `pnpm verify:web` (frontend lint, frontend unit tests, frontend
typecheck + build) — so the fast backend gates report before the slow build,
and so CI can run the two halves as parallel jobs. `package.json` is the single
source of truth for the literal command chain; when it changes, don't paste the
new chain into docs — update the plain-language gate list here and in
`AGENTS.md` §6 (see "Documentation Update" above).

`pnpm verify:full` runs `pnpm doctor` first (it fails fast on a missing venv,
missing `.env`, or placeholder credentials, before the long suite starts), then
`pnpm verify`, then `pnpm test:e2e`. Use it when live local prerequisites are
available:

- root `.env` contains real B2 credentials
- the backend virtualenv `services/api/.venv` exists
- local server binding is permitted
- port 3000 is free, or already serving this app
- Playwright Chromium has been installed

Playwright starts `pnpm dev` from `apps/web/playwright.config.ts` and waits on
`http://localhost:3000`. Note that `next dev` falls back to the next free port
when 3000 is taken, so an unrelated process on 3000 makes `pnpm test:e2e` time
out waiting on a URL the app never claimed — `pnpm doctor` warns about this but
does not fail. The API starts at `localhost:8000` or the next free port chosen
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
- `.github/workflows/ci.yml` runs the two halves of `pnpm verify` —
  `pnpm verify:api` and `pnpm verify:web` — as parallel jobs on every PR and
  push to `main`. Same gates as running `pnpm verify` locally, but they report
  independently, so a frontend failure never hides a backend failure.
- No secrets required — backend tests mock the B2 repo layer and `/health`
  tolerates a degraded connection. `pnpm verify:full` and E2E are not in CI
  because they need a running app, browser install, and live B2 credentials.

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

**Add a new endpoint** — three places to touch:
1. `services/api/app/runtime/<router>.py` — FastAPI route
2. `apps/web/src/lib/api-client.ts` — typed fetch wrapper
3. `apps/web/src/lib/queries.ts` — `useQuery` / `useMutation` hook + entry in `qk`

Defaults (in `apps/web/src/lib/query-client.tsx`):
- `staleTime: 30s` — file lists / stats don't change second-to-second
- `retry: 1` for transient errors; never retry 4xx (won't get better)
- `refetchOnWindowFocus`: on (TanStack default) — dashboard self-heals
  when the user comes back to the tab
