// GENERATED FILE — DO NOT EDIT.
//
// Written by `pnpm gen:api` from:
//   docs/api/openapi.json
//   scripts/gen/api-gen.config.json
//
// Hand edits are discarded by the next `pnpm gen:api`. `pnpm gen:check`
// (part of `pnpm verify:web`) fails while this file disagrees with the
// contract. To change what is here, change the FastAPI route or Pydantic
// model and re-run `pnpm contract:export && pnpm gen:api`.

/**
 * Query keys for every cached read, derived from the contract's paths and
 * query parameters.
 *
 * The key *shape* is a caching decision, so it is declared per operation in
 * `scripts/gen/api-gen.config.json`: a child key nested under a parent's
 * segments (for example activity under stats) is invalidated by invalidating
 * the parent, and that hierarchy is the point. Defaults come from the
 * contract, so calling a member with no arguments produces the same key the
 * API would answer with no query string.
 */
export const qk = {
  all: ["b2"] as const,
  files: (prefix?: string, limit?: number) => [...qk.all, "files", prefix ?? "", limit ?? 100] as const,
  detail: (key: string) => [...qk.all, "detail", key] as const,
  preview: (key: string) => [...qk.all, "preview", key] as const,
  stats: () => [...qk.all, "stats"] as const,
  uploadActivity: (days?: number) => [...qk.all, "stats", "activity", days ?? 7] as const,
  health: () => [...qk.all, "health"] as const,
};
