// GENERATED FILE — DO NOT EDIT.
//
// Written by `pnpm gen:api` from:
//   docs/api/openapi.json
//
// Hand edits are discarded by the next `pnpm gen:api`. `pnpm gen:check`
// (part of `pnpm verify:web`) fails while this file disagrees with the
// contract. To change what is here, change the FastAPI route or Pydantic
// model and re-run `pnpm contract:export && pnpm gen:api`.

export interface B2RoleCount {
  count: number;
  role: string;
}

export interface Body_trigger_snapshot_intelligence_snapshots_post {
  repo?: string | null;
}

export interface CategoryCount {
  category: string;
  count: number;
  percentage: number;
}

export interface Cluster {
  centroid_id: number | null;
  cluster_id: string;
  issue_ids: number[];
  label: string;
  size: number;
  summary: string;
}

/** One day's upload count, for the dashboard activity chart. */
export interface DailyUploadCount {
  date: string;
  uploads: number;
}

/** Acknowledgement that one object was removed from the bucket. */
export interface DeleteFileResponse {
  deleted: boolean;
  key: string;
}

/** One stored object as the file list and the by-key metadata route see it. */
export interface FileMetadata {
  content_type: string;
  filename: string;
  folder: string;
  key: string;
  size_bytes: number;
  size_human: string;
  uploaded_at: string;
  /**
   * Public object URL, set only when B2_PUBLIC_URL_BASE is configured and
   * the bucket is public. Null otherwise — the UI asks for a presigned URL
   * instead.
   */
  url: string | null;
}

/** Rich metadata recomputed on demand by re-reading the stored object. */
export interface FileMetadataDetail {
  /** Audio/video: bits per second. */
  bitrate: number | null;
  /** Audio/video: codec name. */
  codec: string | null;
  /** Audio/video: duration in seconds. */
  duration_seconds: number | null;
  /**
   * Image-specific: EXIF tags, values stringified. Null for non-images or
   * when no EXIF block was present.
   */
  exif: Record<string, string> | null;
  extension: string;
  filename: string;
  /** Image-specific: pixel height. Null for non-images. */
  image_height: number | null;
  /** Image-specific: pixel width. Null for non-images. */
  image_width: number | null;
  md5: string;
  /**
   * Set when a format-specific extractor was skipped or failed (e.g. an
   * image above Pillow's decompression-bomb limit). The core fields are
   * always exact, so the UI shows this instead of silently dropping the
   * Image / PDF section.
   */
  metadata_warning: string | null;
  mime_type: string;
  /** PDF-specific: author. */
  pdf_author: string | null;
  /** PDF-specific: page count. Null for non-PDFs. */
  pdf_pages: number | null;
  /** PDF-specific: title. */
  pdf_title: string | null;
  sha256: string;
  size_bytes: number;
  size_human: string;
  uploaded_at: string;
}

/** The stored object as `POST /upload/verify` reports it back. */
export interface FileUploadResponse {
  content_type: string;
  filename: string;
  key: string;
  /** Rich metadata, when extraction succeeded for this type. */
  metadata: FileMetadataDetail | null;
  size_bytes: number;
  size_human: string;
  uploaded_at: string;
  /** Public object URL when the bucket is public, else null. */
  url: string | null;
}

/** A short-lived presigned GET for downloading or previewing one object. */
export interface FileUrlResponse {
  /**
   * Presigned GET URL. Download URLs force an attachment disposition;
   * preview URLs are signed inline so a PDF renders in place.
   */
  url: string;
}

export interface HTTPValidationError {
  detail?: ValidationError[];
}

/**
 * Liveness plus B2 reachability. The route answers HTTP 200 even when B2
 * is unreachable, so a caller must read `b2_connected` rather than
 * trusting the status code.
 */
export interface HealthStatus {
  /** True when the bucket answered a cheap head request. */
  b2_connected: boolean;
  /** "healthy" when B2 answered, else "degraded". */
  status: string;
}

export interface IssueListItem {
  b2_role: string;
  category: string;
  cluster_id: string;
  created_at: string;
  html_url: string;
  issue_id: number;
  issue_number: number;
  spec_depth_score: number;
  state: string;
  title: string;
}

export interface IssueListResponse {
  items: IssueListItem[];
  limit: number;
  offset: number;
  total: number;
}

export interface IssueSummary {
  b2_role: string;
  category: string;
  cluster_id: string;
  cluster_label: string;
  html_url: string;
  issue_id: number;
  issue_number: number;
  spec_depth_score: number;
  title: string;
}

/** What the browser declares before uploading directly to B2. */
export interface PresignUploadRequest {
  content_type: string;
  filename: string;
  size_bytes: number;
}

/**
 * A short-lived presigned PUT the browser uploads to, plus the exact
 * headers it must send. `Content-Length` and `content-type` are signed
 * into the URL, so B2 rejects a body of any other size or type.
 */
export interface PresignUploadResponse {
  content_type: string;
  expires_in: number;
  /**
   * Signed into the URL, so the browser must send them verbatim — B2
   * answers a mismatch with 403.
   */
  headers: Record<string, string>;
  key: string;
  method: string;
  url: string;
}

export interface SnapshotReport {
  activity_timeline: WeeklyActivity[];
  b2_role_distribution: B2RoleCount[];
  category_breakdown: CategoryCount[];
  closed_issues: number;
  clusters: Cluster[];
  generated_at: string;
  open_issues: number;
  pipeline_cost: Record<string, number>;
  repo: string;
  snapshot_id: string;
  spec_depth_histogram: SpecDepthBucket[];
  thin_issues: IssueSummary[];
  top_specs: IssueSummary[];
  total_issues: number;
}

export interface SnapshotStatus {
  closed_issues: number;
  cluster_count: number;
  error: string;
  fetched_at: string;
  open_issues: number;
  pipeline_cost: Record<string, number>;
  repo: string;
  snapshot_id: string;
  status: string;
  total_issues: number;
}

export interface SpecDepthBucket {
  count: number;
  score_range: string;
}

/** Aggregate bucket figures behind the dashboard stat cards. */
export interface UploadStats {
  total_downloads: number;
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
}

export interface ValidationError {
  ctx?: Record<string, unknown>;
  input?: unknown;
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface VerifyRunDetail {
  duration: number;
  failed: number;
  git_sha: string;
  passed: number;
  results: Record<string, unknown>;
  run_id: string;
  screenshot_urls: string[];
  skipped: number;
  timestamp: string;
  total: number;
  trace_urls: string[];
}

export interface VerifyRunSummary {
  duration: number;
  failed: number;
  git_sha: string;
  passed: number;
  run_id: string;
  skipped: number;
  timestamp: string;
  total: number;
}

/** Sent after the direct PUT so the API can inspect the stored object. */
export interface VerifyUploadRequest {
  key: string;
}

export interface WeeklyActivity {
  cluster_id: string;
  cluster_label: string;
  created_count: number;
  updated_count: number;
  week: string;
}
