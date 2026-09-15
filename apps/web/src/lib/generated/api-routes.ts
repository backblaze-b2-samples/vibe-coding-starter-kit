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

/** The verbs this app's routes actually use, narrowed from the contract. */
export type ApiClientRoute = {
  method: "delete" | "get" | "post";
  path: string;
};

/**
 * Every frontend-callable operation in the contract, keyed by the name
 * `scripts/gen/api-gen.config.json` gives it. `as const` keeps each path and
 * verb a literal type, so a template-literal parameter can require a `{…}`
 * placeholder and a `.method.toUpperCase()` stays exact.
 */
export const API_CLIENT_ROUTES = {
  fileByKeyDelete: { method: "delete", path: "/files-by-key" },
  legacyFileDelete: { method: "delete", path: "/files/{key}" },
  files: { method: "get", path: "/files" },
  fileByKeyDetail: { method: "get", path: "/files-by-key/detail" },
  fileByKeyDownload: { method: "get", path: "/files-by-key/download" },
  fileByKeyMetadata: { method: "get", path: "/files-by-key/metadata" },
  fileByKeyPreview: { method: "get", path: "/files-by-key/preview" },
  legacyFileMetadata: { method: "get", path: "/files/{key}" },
  legacyFileDownload: { method: "get", path: "/files/{key}/download" },
  legacyFilePreview: { method: "get", path: "/files/{key}/preview" },
  fileStats: { method: "get", path: "/files/stats" },
  uploadActivity: { method: "get", path: "/files/stats/activity" },
  health: { method: "get", path: "/health" },
  uploadPresign: { method: "post", path: "/upload/presign" },
  uploadVerify: { method: "post", path: "/upload/verify" },
} as const satisfies Record<string, ApiClientRoute>;
