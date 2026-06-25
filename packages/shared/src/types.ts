export type FileStatus = "uploading" | "complete" | "error";

export interface FileMetadata {
  key: string;
  filename: string;
  folder: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
}

export interface FileMetadataDetail {
  filename: string;
  size_bytes: number;
  size_human: string;
  mime_type: string;
  extension: string;
  md5: string;
  sha256: string;
  uploaded_at: string;
  // Image-specific
  image_width: number | null;
  image_height: number | null;
  exif: Record<string, string> | null;
  // PDF-specific
  pdf_pages: number | null;
  pdf_author: string | null;
  pdf_title: string | null;
  // Audio/Video
  duration_seconds: number | null;
  codec: string | null;
  bitrate: number | null;
}

export interface FileUploadResponse {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
  metadata: FileMetadataDetail | null;
}

export interface DailyUploadCount {
  date: string;
  uploads: number;
}

export interface UploadStats {
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
  total_downloads: number;
}

// Intelligence pipeline types

export type IssueCategory = "sample_app_spec" | "bug" | "enhancement" | "doc" | "meta" | "other";
export type B2Role = "central" | "supporting" | "incidental" | "unclear" | "n/a";
export type SnapshotStatusValue = "running" | "ingested" | "complete" | "failed" | "unknown";

export interface SnapshotStatus {
  snapshot_id: string;
  repo: string;
  fetched_at: string;
  status: SnapshotStatusValue;
  total_issues: number;
  open_issues: number;
  closed_issues: number;
  cluster_count: number;
  pipeline_cost: Record<string, number>;
}

export interface Cluster {
  cluster_id: string;
  label: string;
  summary: string;
  issue_ids: number[];
  size: number;
  centroid_id: number | null;
}

export interface ClusterAssignment {
  issue_id: number;
  cluster_id: string;
}

export interface CategoryCount {
  category: IssueCategory;
  count: number;
  percentage: number;
}

export interface B2RoleCount {
  role: B2Role;
  count: number;
}

export interface WeeklyActivity {
  week: string;
  cluster_id: string;
  cluster_label: string;
  created_count: number;
  updated_count: number;
}

export interface SpecDepthBucket {
  score_range: string;
  count: number;
}

export interface IssueSummary {
  issue_id: number;
  issue_number: number;
  title: string;
  html_url: string;
  category: IssueCategory;
  b2_role: B2Role;
  spec_depth_score: number;
  cluster_id: string;
  cluster_label: string;
}

export interface SnapshotReport {
  snapshot_id: string;
  repo: string;
  generated_at: string;
  total_issues: number;
  open_issues: number;
  closed_issues: number;
  clusters: Cluster[];
  category_breakdown: CategoryCount[];
  b2_role_distribution: B2RoleCount[];
  activity_timeline: WeeklyActivity[];
  spec_depth_histogram: SpecDepthBucket[];
  top_specs: IssueSummary[];
  thin_issues: IssueSummary[];
  pipeline_cost: Record<string, number>;
}

export interface IssueListItem {
  issue_id: number;
  issue_number: number;
  title: string;
  html_url: string;
  state: string;
  category: IssueCategory;
  b2_role: B2Role;
  spec_depth_score: number;
  cluster_id: string;
  created_at: string;
}

export interface IssueListResponse {
  total: number;
  offset: number;
  limit: number;
  items: IssueListItem[];
}
