<!-- last_verified: 2026-07-28 -->
# Agent Usability Remediation Plan

Source: local agent-usability audit, 2026-07-27.

This plan breaks the audit findings into reviewable PRs and GitHub Project cards. Keep implementation PRs small enough that each one has its own evidence, tests, and reviewer focus.

## Tracking Rules

- Public repo plan: keep this file focused on the implementation sequence, code surfaces, and acceptance criteria.
- Private/team tracking: keep board URLs, assignees, and team-only routing details outside this public starter kit.
- Before creating a tracking card, search existing issues and the project board. Update a duplicate instead of creating a new issue.
- Initial card status should be backlog/todo unless work has already started. Move to in-progress when work starts or a PR opens, in-review when review is requested, and done after merge/closure.
- When opening PRs, link the relevant issue in the PR body so GitHub can connect the PR and issue automatically.

## Recommended Sequence

1. Deterministic build
2. Canonical verification
3. Agent instruction safety
4. Cold-start setup and sandbox diagnostics
5. Review handoff templates
6. API contract workflow

PRs 1 and 2 should stay separate unless schedule pressure is high. PR 1 removes the build blocker; PR 2 defines the verification contract that later PRs rely on.

## Card 1: Make the Next.js Build Network-Independent

Status: Done — implemented in commit `d62f4dd` (`fix(web): remove remote font build dependency`) on this branch. Move the corresponding tracking issue to done and link this commit/PR before closing it.

Metadata: Priority P0; suggested labels `CI/build`, `frontend`, `agent-usability` if available; duplicate search terms `Mona Sans`, `next/font/google`, `deterministic build`, `network-independent build`.

### Summary

Make `pnpm build` pass without external network access by removing the Google Fonts build-time fetch.

### Problem

Before this fix, the production build imported `Mona_Sans` from `next/font/google`, which fetched Google Fonts during build. Restricted or offline agent environments failed even when dependencies were already installed.

### Evidence / Examples

- `.local/agent-usability-audit.md` reports `pnpm build` failing in the default sandbox while fetching `https://fonts.googleapis.com/...`. This file is gitignored (local-only audit note) — it isn't reachable to other reviewers, so treat it as provenance, not verifiable evidence.
- The same build passed only after network access was approved.
- Former source: `apps/web/src/app/layout.tsx`.
- Former docs mention of Google font loading: `docs/design-system.md`.

### Expected Result

`pnpm build` succeeds in a network-restricted environment after dependencies are installed.

### Proposed Approach

Use a system font stack or self-host the display font with `next/font/local`. Prefer the smallest change that preserves visual quality and avoids vendoring unnecessary assets.

### Acceptance Criteria

- `pnpm build` passes without external network.
- `rg -n "next/font/google|fonts.googleapis|Mona_Sans" apps/web/src docs --glob '!docs/exec-plans/**'` has no stale remote-font dependency (the glob excludes plan docs like this one, which quote those strings as historical evidence, not live references).
- `docs/design-system.md` describes the chosen font source.
- Verification evidence includes `pnpm build`, `pnpm lint`, and `pnpm test:web`.

### Non-Goals

- No broad visual redesign.
- No unrelated design token changes.

### Dependencies / Blockers

None.

## Card 2: Add Canonical Verification Commands

Status: Done — implemented on this branch (`chore: add canonical verification commands`). Root `package.json` now has `verify`, `verify:api`, `verify:web`, and `verify:full`; `AGENTS.md`, `README.md`, `docs/dev-workflows.md`, the feature docs, and `.github/workflows/ci.yml` all describe the same gates. The "Problem"/"Evidence" sections below describe the pre-change state — read them as history, not as current fact. Move the corresponding tracking issue to done and link this commit/PR before closing it.

Metadata: Priority P1; suggested labels `CI/build`, `docs`, `agent-usability` if available; duplicate search terms `pnpm verify`, `verify:full`, `command drift`, `canonical verification`.

### Summary

Add `pnpm verify` and `pnpm verify:full`, then align docs and CI wording around those commands.

### Problem

The repo has several near-duplicate command chains across `AGENTS.md`, `README.md`, `docs/dev-workflows.md`, feature docs, and CI. Agents do not have one canonical answer for "what proves this PR is done?"

### Evidence / Examples

- Root `package.json` has no `verify` or `verify:full`.
- Audit found drift between `AGENTS.md`, `docs/dev-workflows.md`, feature docs, and CI.
- CI runs web lint/test/build and API lint/test/structure, but docs describe the suite inconsistently.

### Expected Result

Agents and humans can run one default command before PR, and one full command when E2E prerequisites are available.

### Proposed Approach

Add root scripts:
- `pnpm verify`: non-live pre-PR suite, including build after Card 1.
- `pnpm verify:full`: `pnpm verify` plus E2E/browser/live-service checks, with prerequisite notes.

Update `AGENTS.md`, `README.md`, `docs/dev-workflows.md`, feature docs, and CI comments/step names.

### Acceptance Criteria

- `pnpm verify` exists and passes locally.
- `pnpm verify:full` exists and documents or runs E2E prerequisites clearly.
- README, `AGENTS.md`, `docs/dev-workflows.md`, feature docs, and CI describe the same default gates.
- CI uses or clearly mirrors the canonical verify suite.

### Non-Goals

- Do not add new test frameworks.
- Do not include live B2/E2E checks in default CI unless credentials and browser/runtime support are intentionally configured.

### Dependencies / Blockers

Depends on Card 1 so `verify` can include `pnpm build` without network approval.

## Card 3: Protect the Agent Instruction Surface

Status: Done — implemented on this branch (`chore: protect agent instruction surface`). `GEMINI.md` and `.github/copilot-instructions.md` are thin shims to `AGENTS.md`; `pnpm check:agent-docs` validates the canonical instruction surface, shims, command docs, CI claims, and `.env` ignore coverage; `pnpm verify` and CI include the new check.

Metadata: Priority P1; suggested labels `docs`, `tooling`, `agent-usability` if available; duplicate search terms `GEMINI.md`, `copilot-instructions`, `check:agent-docs`, `agent doc health`.

### Summary

Add thin cross-agent instruction shims and a lightweight `pnpm check:agent-docs` drift check.

### Problem

`AGENTS.md` is canonical and `CLAUDE.md` points to it, but other common tools can cold-start without the repo contract. There is also no automated check that shims, command references, and secret ignore rules remain true.

### Evidence / Examples

- Audit found no `GEMINI.md`, `.github/copilot-instructions.md`, `.aider.conf.yml`, or equivalent shims beyond `CLAUDE.md`.
- Root `package.json` has no `check:agent-docs`.
- The audit identified missing explicit no-secret handling in `AGENTS.md`.

### Expected Result

Supported agents discover `AGENTS.md`, and CI prevents common agent-doc regressions.

### Proposed Approach

Add short shims for supported tools, starting with `GEMINI.md` and `.github/copilot-instructions.md`. Add a zero-dependency script `scripts/check-agent-docs.mjs` and expose it as `pnpm check:agent-docs`.

### Acceptance Criteria

- Required shims exist and point to `AGENTS.md` without duplicating full rules.
- `pnpm check:agent-docs` validates `AGENTS.md` presence/size, required shims, documented command truth, CI claim consistency, and `.env` ignore coverage.
- `pnpm check:agent-docs` is included in `pnpm verify` and CI.
- `AGENTS.md` includes an explicit rule not to print `.env`, credentials, or API keys in chat, logs, reports, commits, or screenshots.

### Non-Goals

- Do not duplicate full agent instructions into tool-specific files.
- Do not add shims for tools the team does not expect to support.

### Dependencies / Blockers

Best after Card 2, so `check:agent-docs` can validate the canonical verification commands.

## Card 4: Improve Cold-Start Setup and Sandbox Diagnostics

Status: Done — implemented on this branch (`chore: improve cold-start setup diagnostics`). `pnpm run setup` (`scripts/setup.mjs`) is the single cold-start command; `scripts/local-bind.mjs` classifies bind results as free/busy/denied/unsupported for both `scripts/doctor.mjs` and `scripts/pick-port.mjs`; `README.md` and `docs/dev-workflows.md` document supported platforms, ports, and sandbox permissions. The "Problem"/"Evidence" sections below describe the pre-change state — read them as history, not as current fact. Move the corresponding tracking issue to done and link this commit/PR before closing it.

Metadata: Priority P2; suggested labels `tooling`, `docs`, `agent-usability` if available; duplicate search terms `pnpm setup`, `bootstrap`, `pick-port`, `EPERM`, `sandbox`, `devcontainer`, `WSL`.

### Summary

Add an idempotent setup command, document supported environments, and improve local bind diagnostics for E2E/dev startup.

### Problem

Cold-start setup requires manual sequencing. Platform and cloud-agent support are under-documented. When a sandbox denies local server binding, `scripts/pick-port.mjs` reports ordinary port exhaustion, which sends agents down the wrong path. `scripts/doctor.mjs`'s `isPortBoundOn` has the same `EPERM`/`EADDRINUSE` conflation, but worse: it resolves any non-`EADDRINUSE` error (including `EPERM`/`EACCES`) to "not bound," so `pnpm doctor` — which runs automatically via `predev` before every `pnpm dev` — actively reports a sandboxed port as free instead of surfacing the permission denial.

### Evidence / Examples

- README setup currently requires manual `pnpm install`, Python venv creation, dependency installation, and `.env` copy.
- Root `package.json` has no `setup` or `bootstrap`.
- Audit confirmed bind probes returned `EPERM`, while `pick-port` reported `no free port`.
- `scripts/doctor.mjs`'s `isPortBoundOn` (`res(err.code === "EADDRINUSE")`) treats `EPERM`/`EACCES` as "port free," masking the same class of sandbox bind denial in the tool meant to catch it.
- API scripts use Unix-style venv paths, so Windows support expectations are unclear.

### Expected Result

A new agent can run one setup command, validate with `pnpm doctor`, and understand local server permission failures.

### Proposed Approach

Add `pnpm setup` backed by an idempotent script. It should install workspace dependencies, create `services/api/.venv` if missing, install API requirements, and copy `.env.example` to `.env` only if `.env` is absent. Update both `pick-port` and `doctor.mjs`'s `isPortBoundOn` to distinguish `EADDRINUSE` (port taken) from `EPERM`/`EACCES` (sandbox/permission denial) and report each distinctly. Document macOS, Linux, WSL, native Windows status, cloud agents, required ports, and network assumptions.

### Acceptance Criteria

- `pnpm setup` can be rerun safely and does not overwrite `.env`.
- `pnpm setup` followed by `pnpm doctor` succeeds or fails with actionable credential guidance.
- `node scripts/pick-port.mjs 8000` reports permission/sandbox denial clearly when bind returns `EPERM` or `EACCES`.
- `pnpm doctor` (and its `isPortBoundOn` check) reports permission/sandbox denial distinctly from "port in use," instead of resolving to "port free."
- README and `docs/dev-workflows.md` document E2E local server/browser permission requirements.
- Verification evidence includes `pnpm setup`, `pnpm doctor`, `node scripts/pick-port.mjs 8000`, and `pnpm test:e2e` when local server startup is allowed.

### Non-Goals

- Do not introduce Docker/devcontainer unless it can stay minimal and deterministic.
- Do not solve Python dependency locking in the same PR unless explicitly scoped.

### Dependencies / Blockers

Can follow Card 2. E2E verification may need local server/browser permission.

## Card 5: Add GitHub Review Handoff Templates

Status: Done — implemented on this branch (`chore: add GitHub review handoff templates`). `.github/PULL_REQUEST_TEMPLATE.md` and `.github/ISSUE_TEMPLATE/coding-agent-handoff.md` prefill scope, acceptance criteria, command evidence, skipped checks, UI evidence, docs, and risk/rollback; `docs/dev-workflows.md` documents both templates and carries the canonical "Review ownership" statement that no `CODEOWNERS` file is configured. No `CODEOWNERS` was invented — ownership stays explicitly unset per the non-goal below. The "Problem"/"Evidence" sections below describe the pre-change state — read them as history, not as current fact. Move the corresponding tracking issue to done and link this commit/PR before closing it.

Metadata: Priority P2; suggested labels `process`, `docs`, `agent-usability` if available; duplicate search terms `PR template`, `issue template`, `CODEOWNERS`, `command evidence`, `review handoff`.

### Summary

Add lightweight GitHub issue and PR templates optimized for coding-agent handoffs.

### Problem

The repo has PR guidance in docs, but GitHub-native issues and PRs do not require scope, acceptance criteria, command evidence, screenshots, skipped checks, or risk notes.

### Evidence / Examples

- Audit found no `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE*`, `CONTRIBUTING.md`, or `CODEOWNERS`.
- `docs/dev-workflows.md` has a checklist, but reviewers do not see it automatically in GitHub.

### Expected Result

New issues and PRs carry enough context for agent implementation and human review.

### Proposed Approach

Add issue and PR templates with summary, problem, evidence, expected result, proposed approach, acceptance criteria, non-goals, dependencies/blockers, test evidence, UI screenshots when relevant, docs updates, skipped checks, and risk/rollback notes. Add CODEOWNERS only if ownership is known; otherwise document that ownership is intentionally unset.

### Acceptance Criteria

- New issue template guides requesters toward clear scope and acceptance criteria.
- New PR template asks for command evidence and skipped-check explanations.
- Review ownership is discoverable or explicitly documented as unset.

### Non-Goals

- Do not add heavyweight contribution process.
- Do not invent CODEOWNERS without maintainer confirmation.

### Dependencies / Blockers

None.

## Card 6: Add an API Contract Workflow

Status: Done — implemented on this branch (`chore: add API contract workflow`).
`docs/api/openapi.json` is checked in; `pnpm contract:export` refreshes it;
`pnpm contract:check` verifies artifact freshness and the frontend route
registry; `pnpm test:api` and `pnpm test:web` include the same drift coverage.
Full OpenAPI codegen stays out of scope unless this lightweight workflow proves
insufficient.

Metadata: Priority P2; suggested labels `backend`, `frontend`, `tooling` if available; duplicate search terms `OpenAPI`, `api-client`, `contract drift`, `codegen`, `openapi.json`.

### Summary

Add a deterministic API contract workflow so FastAPI routes and the frontend API client cannot silently diverge.

### Problem

FastAPI exposes OpenAPI at runtime, but there is no checked-in contract artifact, export command, codegen path, or drift check. The frontend `api-client.ts` is hand-synced.

### Evidence / Examples

- Audit found runtime OpenAPI only.
- This card supersedes the tracker row, not duplicates it: `docs/exec-plans/tech-debt-tracker.md` already has an open "`api-client.ts` hand-synced to FastAPI" entry. Remove that row (move to Resolved, pointing at this card's PR) once this card ships, instead of letting both drift independently.

### Expected Result

API route/client changes have a repeatable review and verification path.

### Proposed Approach

Start with a deterministic OpenAPI export command or checked-in artifact, then add a lightweight contract/client drift check. Decide separately whether full codegen is worth the maintenance cost.

### Acceptance Criteria

- There is a repeatable command for inspecting or exporting the API contract.
- Docs reference the contract path or command.
- A route/client mismatch is caught by a test, generated type check, or documented drift check.

### Non-Goals

- Do not rewrite the entire frontend data layer.
- Do not introduce full codegen unless the first contract workflow proves it is needed.

### Dependencies / Blockers

Can be implemented independently after the verification command exists.

## Operating Notes

- Keep one PR per card unless two cards share one implementation surface and the combined diff remains easy to review.
- Each PR should update docs in the same PR as code changes.
- When a card changes after investigation, update the GitHub issue with what changed, what was found, the decision made, blockers, and the next step.
- Follow AGENTS.md Section 7 (Agent Workflow), step 7, for moving this plan to `docs/exec-plans/completed/` once all cards are done.
