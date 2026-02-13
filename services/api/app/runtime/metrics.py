import time
from collections import defaultdict

from fastapi import APIRouter, Request, Response

router = APIRouter()

# Simple in-process metrics counters
_request_count: dict[str, int] = defaultdict(int)
_request_duration_sum: dict[str, float] = defaultdict(float)
_upload_count = 0
_upload_errors = 0


def record_request(method: str, path: str, status: int, duration: float) -> None:
    key = f'{method}_{path}_{status}'
    _request_count[key] += 1
    _request_duration_sum[key] += duration


def record_upload(success: bool) -> None:
    global _upload_count, _upload_errors
    if success:
        _upload_count += 1
    else:
        _upload_errors += 1


@router.get("/metrics")
async def metrics():
    lines = []
    lines.append("# HELP http_requests_total Total HTTP requests")
    lines.append("# TYPE http_requests_total counter")
    for key, count in sorted(_request_count.items()):
        parts = key.rsplit("_", 1)
        method_path = parts[0] if len(parts) == 2 else key
        status = parts[1] if len(parts) == 2 else "unknown"
        lines.append(
            f'http_requests_total{{key="{method_path}",status="{status}"}} {count}'
        )

    lines.append("# HELP http_request_duration_seconds Total request duration")
    lines.append("# TYPE http_request_duration_seconds counter")
    for key, duration in sorted(_request_duration_sum.items()):
        lines.append(
            f'http_request_duration_seconds{{key="{key}"}} {duration:.6f}'
        )

    lines.append("# HELP uploads_total Total uploads")
    lines.append("# TYPE uploads_total counter")
    lines.append(f"uploads_total {_upload_count}")

    lines.append("# HELP upload_errors_total Total upload errors")
    lines.append("# TYPE upload_errors_total counter")
    lines.append(f"upload_errors_total {_upload_errors}")

    return Response(content="\n".join(lines) + "\n", media_type="text/plain")


async def timing_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    record_request(
        request.method,
        request.url.path,
        response.status_code,
        duration,
    )
    return response
