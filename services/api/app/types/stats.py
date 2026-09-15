from app.types.base import ResponseModel


class DailyUploadCount(ResponseModel):
    """One day's upload count, for the dashboard activity chart."""

    date: str
    uploads: int


class UploadStats(ResponseModel):
    """Aggregate bucket figures behind the dashboard stat cards."""

    total_files: int
    total_size_bytes: int
    total_size_human: str
    uploads_today: int
    total_downloads: int
