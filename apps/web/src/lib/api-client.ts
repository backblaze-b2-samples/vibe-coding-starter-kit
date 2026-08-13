import type {
  DailyUploadCount,
  FileMetadata,
  FileMetadataDetail,
  FileUploadResponse,
  PresignUploadResponse,
  UploadStats,
} from "@vibe-coding-starter-kit/shared";

// Single-origin deploys (Vercel `services`: one project serving web + API) put
// the API under /api on the same origin, so no NEXT_PUBLIC_API_URL is needed —
// a production build with it unset defaults to the relative "/api". An explicit
// NEXT_PUBLIC_API_URL still wins (two-project / separate-origin deploys). Local
// dev (NODE_ENV !== "production") falls back to the dev API port.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:8000");

type ApiClientRoute = {
  method: "delete" | "get" | "post";
  path: string;
};

export const API_CLIENT_ROUTES = {
  health: { method: "get", path: "/health" },
  files: { method: "get", path: "/files" },
  fileStats: { method: "get", path: "/files/stats" },
  uploadActivity: { method: "get", path: "/files/stats/activity" },
  fileByKeyDownload: { method: "get", path: "/files-by-key/download" },
  fileByKeyPreview: { method: "get", path: "/files-by-key/preview" },
  fileByKeyMetadata: { method: "get", path: "/files-by-key/metadata" },
  fileByKeyDetail: { method: "get", path: "/files-by-key/detail" },
  fileByKeyDelete: { method: "delete", path: "/files-by-key" },
  legacyFileDownload: { method: "get", path: "/files/{key}/download" },
  legacyFilePreview: { method: "get", path: "/files/{key}/preview" },
  legacyFileMetadata: { method: "get", path: "/files/{key}" },
  legacyFileDelete: { method: "delete", path: "/files/{key}" },
  // Uploads go direct to B2: the API validates + signs a PUT (presign), the
  // browser uploads the bytes straight to B2, then the API inspects the stored
  // object (verify). Bytes never traverse the API, so Vercel's ~4.5 MB Function
  // payload ceiling no longer caps upload size.
  uploadPresign: { method: "post", path: "/upload/presign" },
  uploadVerify: { method: "post", path: "/upload/verify" },
} as const satisfies Record<string, ApiClientRoute>;

/** Typed API error with HTTP status code for caller-side branching. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True for 408, 429, 500, 502, 503, 504 — worth retrying. */
  get isRetryable(): boolean {
    return [408, 429, 500, 502, 503, 504].includes(this.status);
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

/**
 * Build the right status-0 ApiError for a thrown fetch().
 *
 * fetch() rejects with a TypeError for genuinely-offline/DNS failures AND for
 * responses the browser refused to expose — most notably a cross-origin 500
 * that shipped without `Access-Control-Allow-Origin`. We can't tell those apart
 * from the error object, but `navigator.onLine === false` reliably means the
 * device has no connectivity. Anything else reached the network, so the most
 * likely cause is the server erroring with a CORS-blocked response — point the
 * developer at the API logs instead of blaming their connection.
 */
function networkError(): ApiError {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return new ApiError("You appear to be offline — check your connection", 0);
  }
  return new ApiError(
    "Couldn't reach the API, or the server returned an error the browser blocked (CORS). Check the API logs.",
    0,
  );
}

/**
 * Build the status-0 ApiError for a failed browser→B2 PUT.
 *
 * Deliberately not `networkError()`: these bytes never touch the API, so
 * "check the API logs" sends the developer to the one place that looks fine —
 * the presign that produced this URL succeeded and logged a clean 200.
 *
 * On a deployed origin the overwhelmingly likely cause is that the *bucket's*
 * CORS does not allow that origin, so the browser blocks the PUT before it
 * leaves and XHR reports only a contentless `error` event. Local dev rarely
 * trips it because localhost origins are usually already allowed — which is
 * exactly why it first appears immediately after a deploy. Name the cause and
 * the remedy instead of leaving a mystery.
 */
function storageNetworkError(): ApiError {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return new ApiError("You appear to be offline — check your connection", 0);
  }
  return new ApiError(
    "Couldn't upload to B2 storage. If this app is deployed, the bucket's CORS " +
      "must allow this origin — run services/api/scripts/setup_b2_cors.py " +
      "--origin <your origin>.",
    0,
  );
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw networkError();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      body.detail || `API error: ${res.status}`,
      res.status,
    );
  }
  return res.json();
}

function isEndpointUnavailable(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    (error.message === "Not Found" || error.message === "API error: 404")
  );
}

async function apiFetchWithLegacyFallback<T>(
  path: string,
  legacyPath: () => string,
  init?: RequestInit
): Promise<T> {
  try {
    return await apiFetch<T>(path, init);
  } catch (error) {
    if (isEndpointUnavailable(error)) {
      return apiFetch<T>(legacyPath(), init);
    }
    throw error;
  }
}

function fileKeyQuery(key: string): string {
  if (key.length === 0) {
    throw new ApiError("File key is required", 400);
  }
  return new URLSearchParams({ key }).toString();
}

function legacyFileKeyPath(
  key: string,
  options: { blockRouteCollisions?: boolean } = {}
): string {
  if (!isLegacyPathFallbackSafe(key, options)) {
    throw new ApiError("Current API version required for this file key", 404);
  }
  return encodeURIComponent(key);
}

/**
 * Substitute a file key into a legacy `{key}` path template. The parameter type
 * requires the literal `{key}` placeholder, so passing a registry path that has
 * no placeholder is a compile error rather than a silent no-op that would send
 * the request to a keyless URL.
 */
function legacyFileKeyRoute(
  path: `${string}{key}${string}`,
  key: string,
  options: { blockRouteCollisions?: boolean } = {}
): string {
  return path.replace("{key}", legacyFileKeyPath(key, options));
}

function isLegacyPathFallbackSafe(
  key: string,
  { blockRouteCollisions = false }: { blockRouteCollisions?: boolean } = {}
): boolean {
  if (/(\.\.\/|\/\.\.|\\|%2e%2e|%00|\x00)/i.test(key)) return false;
  if (!blockRouteCollisions) return true;

  const lowerKey = key.toLowerCase();
  if (lowerKey === "stats" || lowerKey === "stats/activity") return false;
  if (lowerKey.endsWith("/download") || lowerKey.endsWith("/preview")) return false;
  return true;
}

export async function getHealth() {
  return apiFetch<{ status: string; b2_connected: boolean }>(
    API_CLIENT_ROUTES.health.path
  );
}

export async function getFiles(prefix = "", limit = 100) {
  return apiFetch<FileMetadata[]>(
    `${API_CLIENT_ROUTES.files.path}?prefix=${encodeURIComponent(prefix)}&limit=${limit}`
  );
}

export async function getFileStats() {
  return apiFetch<UploadStats>(API_CLIENT_ROUTES.fileStats.path);
}

export async function getUploadActivity(days = 7) {
  return apiFetch<DailyUploadCount[]>(
    `${API_CLIENT_ROUTES.uploadActivity.path}?days=${days}`
  );
}

export async function getFile(key: string) {
  return apiFetchWithLegacyFallback<FileMetadata>(
    `${API_CLIENT_ROUTES.fileByKeyMetadata.path}?${fileKeyQuery(key)}`,
    () =>
      legacyFileKeyRoute(API_CLIENT_ROUTES.legacyFileMetadata.path, key, {
        blockRouteCollisions: true,
      })
  );
}

/**
 * Rich metadata (checksums, image/PDF fields) for an already-stored file.
 * The server recomputes this on demand by downloading the object, so it's a
 * heavier call than getFile — fetch it lazily (only when the user asks to see
 * details). No legacy path fallback: this endpoint is new, so an older backend
 * wouldn't serve it under any route.
 */
export async function getFileDetail(key: string) {
  return apiFetch<FileMetadataDetail>(
    `${API_CLIENT_ROUTES.fileByKeyDetail.path}?${fileKeyQuery(key)}`
  );
}

export async function getDownloadUrl(key: string) {
  return apiFetchWithLegacyFallback<{ url: string }>(
    `${API_CLIENT_ROUTES.fileByKeyDownload.path}?${fileKeyQuery(key)}`,
    () => legacyFileKeyRoute(API_CLIENT_ROUTES.legacyFileDownload.path, key)
  );
}

/** Preview-only presigned URL — does NOT increment the download counter. */
export async function getPreviewUrl(key: string) {
  return apiFetchWithLegacyFallback<{ url: string }>(
    `${API_CLIENT_ROUTES.fileByKeyPreview.path}?${fileKeyQuery(key)}`,
    () => legacyFileKeyRoute(API_CLIENT_ROUTES.legacyFilePreview.path, key)
  );
}

export async function deleteFile(key: string) {
  return apiFetchWithLegacyFallback<{ deleted: boolean; key: string }>(
    `${API_CLIENT_ROUTES.fileByKeyDelete.path}?${fileKeyQuery(key)}`,
    () => legacyFileKeyRoute(API_CLIENT_ROUTES.legacyFileDelete.path, key),
    {
      // Derived from the registry so the verb the contract test checks is the
      // verb actually sent — a hardcoded "DELETE" could silently disagree.
      method: API_CLIENT_ROUTES.fileByKeyDelete.method.toUpperCase(),
    }
  );
}

/**
 * Upload a file directly to B2 in three steps: presign (the API validates the
 * declared file and signs a short-lived PUT), a direct browser→B2 PUT, then
 * verify (the API inspects the stored object). The bytes never pass through the
 * API, which is what removes Vercel's ~4.5 MB Function payload ceiling.
 *
 * The `(file, onProgress) => FileUploadResponse` signature is unchanged, so the
 * upload queue and progress UI don't care that the transport changed. Progress
 * tracks the browser→B2 leg; when it reaches 100% the queue enters its
 * server-side phase (see `upload-status`) while `verify` runs.
 */
export async function uploadFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<FileUploadResponse> {
  const presign = await apiFetch<PresignUploadResponse>(
    API_CLIENT_ROUTES.uploadPresign.path,
    {
      method: API_CLIENT_ROUTES.uploadPresign.method.toUpperCase(),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        content_type: file.type,
        size_bytes: file.size,
      }),
    }
  );

  await putFileToStorage(presign, file, onProgress);

  return apiFetch<FileUploadResponse>(API_CLIENT_ROUTES.uploadVerify.path, {
    method: API_CLIENT_ROUTES.uploadVerify.method.toUpperCase(),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: presign.key }),
  });
}

/**
 * PUT the raw file bytes to the presigned B2 URL. XHR (not fetch) because only
 * XHR exposes upload progress. The signed URL binds the exact size and
 * content-type, so `presign.headers` must be sent verbatim — B2 answers a
 * mismatch with 403.
 */
function putFileToStorage(
  presign: PresignUploadResponse,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        // B2 errors are XML, not JSON — surface a stable message rather than
        // the raw body (a 403 here means the signed size/type was violated).
        reject(
          new ApiError(`Upload to storage failed (${xhr.status})`, xhr.status)
        );
      }
    });

    xhr.addEventListener("error", () => reject(storageNetworkError()));
    xhr.addEventListener("abort", () =>
      reject(new ApiError("Upload aborted", 0)),
    );

    xhr.open(presign.method.toUpperCase(), presign.url);
    for (const [name, value] of Object.entries(presign.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.send(file);
  });
}
