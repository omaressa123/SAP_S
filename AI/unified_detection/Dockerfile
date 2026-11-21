# Unified person + fall detection inference service.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app/unified_detection

# System deps for OpenCV headless + MediaPipe
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Install CPU-only torch first to avoid downloading 3.5GB+ of heavy CUDA/NVIDIA wheels,
# then install remaining dependencies with increased retries and timeouts for reliable fast builds.
RUN pip install --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir --retries 10 --default-timeout 120 -r requirements.txt

COPY pipeline.py .
COPY inference_server.py .
COPY config.yaml .

EXPOSE 8004

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8004/health')"

CMD ["uvicorn", "inference_server:app", "--host", "0.0.0.0", "--port", "8004"]
