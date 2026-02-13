import json
import logging
import sys
from datetime import UTC, datetime

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from starlette.middleware.base import BaseHTTPMiddleware  # noqa: E402

from app.config import settings  # noqa: E402
from app.runtime import files, health, metrics, upload  # noqa: E402

# --- Structured JSON logging ---

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = str(record.exc_info[1])
        return json.dumps(log_entry)


handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JSONFormatter())
logging.root.handlers = [handler]
logging.root.setLevel(logging.INFO)
# Quiet noisy libraries
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("botocore").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

logger = logging.getLogger("api")


# --- App setup ---

app = FastAPI(
    title="OSS Starter Kit API",
    description="File upload and management API backed by Backblaze B2",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Request ID + timing middleware
app.add_middleware(BaseHTTPMiddleware, dispatch=metrics.timing_middleware)

app.include_router(health.router, tags=["health"])
app.include_router(upload.router, tags=["upload"])
app.include_router(files.router, tags=["files"])
app.include_router(metrics.router, tags=["metrics"])
