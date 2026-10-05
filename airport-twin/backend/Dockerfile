# Airport Twin FastAPI service (own schema: twin_* tables, may share postgres).
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Context is ./airport-twin. WORKDIR /app mirrors the local `backend/` layout,
# and /apps holds the web-client asset the seed step reads at
# <repo>/apps/web-client/public/assets/registry.json.
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY backend/main.py backend/smoke_test.py ./
COPY backend/api ./api
COPY backend/models ./models
COPY backend/services ./services
COPY backend/alembic ./alembic
COPY apps/web-client/public/assets/registry.json /apps/web-client/public/assets/registry.json

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8100

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/health')"

# Alembic migrations run at startup (seed() calls upgrade()); then serve.
CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port 8100"]
