FROM python:3.12-slim

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY services/api/requirements.lock ./requirements.lock
RUN pip install --requirement requirements.lock

COPY services/api/ ./
RUN useradd --create-home --uid 10001 appuser \
    && mkdir --parents /app/.data \
    && chown --recursive appuser:appuser /app

USER appuser
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
