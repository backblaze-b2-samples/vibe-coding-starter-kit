from pydantic import BaseModel


class UploadStats(BaseModel):
    total_files: int
    total_size_bytes: int
    total_size_human: str
    uploads_today: int
