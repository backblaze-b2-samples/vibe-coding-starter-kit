# Plan: Complete UI Starter Kit

## Scope
- Close the gap between "B2 file demo" and "general-purpose web app starter" by
  adding the missing UI primitives, form foundation, list ergonomics, and
  design-system documentation that most web apps need on day one.
- Kit stays B2-focused — new routes (/settings, /design) exist to demonstrate
  the primitives in context, not to add unrelated business features.

## Out of scope
- Backend API changes (no new endpoints).
- Authentication / multi-tenant.
- Frontend unit test framework (logged in tech-debt-tracker).

## Steps

### Phase 1 — Design-system foundation
1. Expand `globals.css` tokens: full shadow scale, z-index scale, motion
   tokens, promote `--success` / `--attention` to `@theme inline` so they
   compose with Tailwind utilities.
2. Add `app/not-found.tsx` (Primer-styled 404).
3. Add `app/loading.tsx` (route-level shell skeleton).
4. Add `components/ui/empty-state.tsx` (shared primitive, hand-rolled).
5. Generate `shadcn add alert` for banner-style messaging.

### Phase 2 — Form foundation + /settings demo
1. `shadcn add textarea checkbox radio-group switch select form popover`.
2. Add deps: `react-hook-form`, `zod`, `@hookform/resolvers`.
3. Create `/settings` route demonstrating validated form, Danger Zone alert,
   and every form primitive in realistic B2-app context.
4. Add Settings nav item to sidebar.

### Phase 3 — List ergonomics + command palette
1. `shadcn add pagination accordion collapsible command`.
2. Add dep: `@tanstack/react-table`.
3. Add `components/ui/data-table.tsx` reusable wrapper (sortable + paginated).
4. Wire real `cmdk` palette to the header search pill — `/` and `⌘K` hotkeys,
   searches filenames, jumps to routes.
5. Add pagination to `/files` list mode.

### Phase 4 — Showcase + docs
1. Add `/design` route: single-page showcase of tokens, primitives, patterns.
2. Write `docs/design-system.md`: color, typography, spacing, motion, a11y.
3. Update `docs/dev-workflows.md` with new conventions.
4. Update `README.md` feature list.

### Phase 5 — Verify
1. `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`.
2. Dev-server smoke test every route (including new ones).

## Risks
- `@tanstack/react-table` adds weight but is the convention for shadcn data
  tables; alternative is hand-rolled sort/pagination which is fine for
  starter scale but less extensible.
- File size rule (300 lines) — `/settings` and `/design` will be split into
  subcomponents if they approach the limit.
- cmdk search currently filters client-side only; server-side search is a
  future enhancement, logged in tech-debt-tracker if needed.
