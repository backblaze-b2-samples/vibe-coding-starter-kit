<!-- last_verified: 2026-08-14 -->
# Frontend Conventions

Read this before building or restyling a screen, or before wiring a new endpoint
into the UI. The token and primitive catalog it builds on lives in
[design-system.md](design-system.md).

## Conventions

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

## Building a screen

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
