<!-- last_verified: 2026-06-06 -->
# Dev Workflows

Engineering workflows for this repo.

## New Feature

- [ ] Read `AGENTS.md` and `ARCHITECTURE.md`
- [ ] Read the relevant feature doc in `docs/features/`
- [ ] For non-trivial changes, create a plan in `docs/exec-plans/active/`
- [ ] Implement the smallest coherent change
- [ ] Add or update tests
- [ ] Run: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- [ ] Update docs in the same PR (see AGENTS.md §8)
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

- [ ] Update only the canonical location (see AGENTS.md §8 doc update mapping)
- [ ] Never duplicate content — link instead
- [ ] Update `<!-- last_verified: YYYY-MM-DD -->` header

## Pull Request

- [ ] One coherent change per PR
- [ ] Run full lint + test suite before submitting
- [ ] Docs updated in the same PR as code changes
- [ ] Only change files relevant to the task — no drive-by improvements

## Testing

Tests split into a **credential-free** half (runs on every PR, mocks B2) and a
**live** half (needs a real throwaway B2 bucket). Keep new backend tests
credential-free unless they specifically validate the B2 integration.

### Test types
- **Unit**: pure logic — service/formatting/metadata layers (`tests/test_formatting.py`, `tests/test_metadata.py`)
- **Integration (mocked)**: HTTP handlers with the B2 layer monkeypatched (`tests/`)
- **Integration (live)**: real B2 round-trip via `app/repo/b2_client.py` — marked
  `@pytest.mark.integration`, **auto-skipped when B2 creds are absent** (`tests/test_b2_integration.py`)
- **Structural**: layering rules, import boundaries (`tests/test_structure.py`)
- **E2E**: Playwright drives the real upload → preview → download → delete flow
  against live B2 (`apps/web/e2e/upload.spec.ts`); requires a configured `.env`,
  same as `pnpm dev`

### Test placement
- Backend: `services/api/tests/`
- E2E: `apps/web/e2e/` (Playwright)

### Commands
- Quick (backend): `pnpm test:api` — hermetic; live integration tests skip
- Backend lint: `pnpm lint:api`
- Frontend lint: `pnpm lint`
- Structure: `pnpm check:structure`
- Full suite: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Live B2 round-trip: `pnpm test:api:integration` (needs `.env` creds)
- E2E (live): `pnpm test:e2e` (needs `.env` creds)
- Onboarding smoke: `pnpm smoke` (against a running `pnpm dev`)

### CI
- `.github/workflows/ci.yml` — credential-free: lint + build + pytest + structure on every push/PR
- `.github/workflows/integration.yml` — live: `pnpm test:api:integration` + `pnpm test:e2e`,
  gated on B2 repo secrets (runs on `main` / manual dispatch only)

### When to run
- After behavior change: run relevant subset
- Before PR: run full credential-free suite
- Before a customer release: work through [RELEASE-QA.md](RELEASE-QA.md)

## Frontend Conventions

- Tailwind v4: config via CSS `@theme` blocks, NOT `tailwind.config.ts`
- Colors: OKLch format
- Dark mode: `next-themes` with `@custom-variant dark (&:is(.dark *))`
- Animations: `tw-animate-css` (not `tailwindcss-animate`)
- shadcn/ui components in `src/components/ui/` are generated — never modify them

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
