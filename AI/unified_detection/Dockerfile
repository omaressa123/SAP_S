# Unified person + baggage + fall detection inference service.
# Build context: ./AI
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

COPY unified_detection/requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir --retries 10 --default-timeout 120 -r requirements.txt && \
    pip install --no-cache-dir lap python-multipart

# Copy shared AI modules and unified_detection service
COPY Baggage_And_Person_Detector /app/Baggage_And_Person_Detector
COPY fulldetection /app/fulldetection
COPY unified_detection /app/unified_detection

ENV PYTHONPATH="/app/Baggage_And_Person_Detector:/app/fulldetection/src:/app/unified_detection"

EXPOSE 8004

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8004/health')"

CMD ["uvicorn", "inference_server:app", "--host", "0.0.0.0", "--port", "8004"]
