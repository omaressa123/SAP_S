"""Single Flask connector for all 4 modules.

Modules:
  - airport-twin  (FastAPI backend/main.py:app)       -> :8001
  - face_reco     (FastAPI app/main.py:app)           -> :8002
  - fulldetection (web_app.py ThreadingHTTPServer)    -> :8003
  - smoke_fire_detection (no server; native Flask inference here)

Run:
    pip install flask ultralytics  # + each module's requirements
    python run.py                  # Flask gateway on :5000, spawns the 3 servers
"""
import os
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import urllib.error
from pathlib import Path

from flask import Flask, Response, request, jsonify, redirect

ROOT = Path(__file__).resolve().parent
TWIN_DIR = ROOT / "airport-twin" / "backend"
FACE_DIR = ROOT / "face_reco"
FALL_DIR = ROOT / "fulldetection"
SMOKE_DIR = ROOT / "smoke_fire_detection"

TWIN_PORT = int(os.getenv("TWIN_PORT", "8001"))
FACE_PORT = int(os.getenv("FACE_PORT", "8002"))
FALL_PORT = int(os.getenv("FALL_PORT", "8003"))
FLASK_PORT = int(os.getenv("PORT", "5000"))

app = Flask(__name__)
_procs: list[subprocess.Popen] = []

def _spawn(cmd, cwd, env_extra=None):
    env = os.environ.copy()
    env.setdefault("PYTHONUNBUFFERED", "1")
    if env_extra:
        env.update(env_extra)
    p = subprocess.Popen(cmd, cwd=str(cwd), env=env)
    _procs.append(p)
    return p


def start_modules():
    """Launch each module's native server as a subprocess (idempotent)."""
    if _procs:
        return
    _spawn([sys.executable, "-m", "uvicorn", "main:app",
            "--host", "127.0.0.1", "--port", str(TWIN_PORT)], TWIN_DIR)
    _spawn([sys.executable, "-m", "uvicorn", "app.main:app",
            "--host", "127.0.0.1", "--port", str(FACE_PORT)], FACE_DIR)
    _spawn([sys.executable, "web_app.py",
            "--host", "127.0.0.1", "--port", str(FALL_PORT)], FALL_DIR)
    # smoke_fire_detection has no server: served natively below (/smoke/*).


def _proxy(target_base):
    url = target_base + request.full_path
    data = request.get_data() or None
    headers = {k: v for k, v in request.headers if k.lower() not in ("host",)}
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method=request.method)
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()
            resp = Response(body, status=r.status)
            for k, v in r.headers.items():
                if k.lower() not in ("content-length", "transfer-encoding", "connection"):
                    resp.headers[k] = v
            return resp
    except urllib.error.HTTPError as e:
        return Response(e.read(), status=e.code, content_type="application/json")
    except Exception as e:
        return jsonify({"error": f"upstream unreachable: {e}", "upstream": target_base}), 502


def _check(url, timeout=3):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return {"ok": True, "status": r.status}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/")
def index():
    return jsonify({
        "gateway": "smart-airport run.py (Flask)",
        "routes": {
            "/": "this index",
            "/health": "aggregated health of all modules",
            "/twin/<path>": f"airport-twin FastAPI on :{TWIN_PORT}  (e.g. /twin/health, /twin/api/twin/*)",
            "/face/<path>": f"face_reco FastAPI on :{FACE_PORT}  (e.g. /face/health, /face/docs)",
            "/fall/<path>": f"fulldetection web UI on :{FALL_PORT}  (e.g. /fall/ -> upload page)",
            "/smoke/health": "smoke_fire_detection native inference status",
            "/smoke/predict": "POST multipart image -> {class, confidence} (native)",
        },
    })


@app.get("/health")
def health():
    return jsonify({
        "gateway": "ok",
        "airport_twin": _check(f"http://127.0.0.1:{TWIN_PORT}/health"),
        "face_reco": _check(f"http://127.0.0.1:{FACE_PORT}/health"),
        "fulldetection": _check(f"http://127.0.0.1:{FALL_PORT}/"),
        "smoke_fire": smoke_status(),
    })


# --- airport-twin ---
@app.route("/twin", defaults={"path": ""}, methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
@app.route("/twin/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
def twin(path):
    if path == "":
        return redirect(f"http://127.0.0.1:{TWIN_PORT}/docs", code=302)
    return _proxy(f"http://127.0.0.1:{TWIN_PORT}/{path}")


# --- face_reco ---
@app.route("/face", defaults={"path": ""}, methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
@app.route("/face/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
def face(path):
    if path == "":
        return redirect(f"http://127.0.0.1:{FACE_PORT}/docs", code=302)
    return _proxy(f"http://127.0.0.1:{FACE_PORT}/{path}")


# --- fulldetection (fall) ---
@app.route("/fall", defaults={"path": ""}, methods=["GET", "POST"])
@app.route("/fall/<path:path>", methods=["GET", "POST"])
def fall(path):
    if path == "":
        return _proxy(f"http://127.0.0.1:{FALL_PORT}/")
    return _proxy(f"http://127.0.0.1:{FALL_PORT}/{path}")


# --- smoke_fire_detection (native Flask inference; repo is training-only) ---
_smoke_model = None

def _smoke_weights():
    cands = [
        SMOKE_DIR / "outputs" / "smoke_fire_v1" / "weights" / "best.pt",
        SMOKE_DIR / "yolov8s-cls.pt",
        SMOKE_DIR / "yolo26n.pt",
    ]
    for c in cands:
        if c.exists():
            return str(c)
    return None


def smoke_status():
    w = _smoke_weights()
    return {"ok": True, "weights": w, "loaded": _smoke_model is not None}


@app.get("/smoke/health")
def smoke_health():
    return jsonify(smoke_status())


@app.post("/smoke/predict")
def smoke_predict():
    global _smoke_model
    if "image" not in request.files:
        return jsonify({"error": "send multipart form with 'image' file"}), 400
    weights = _smoke_weights()
    if not weights:
        return jsonify({"error": "no weights found"}), 503
    try:
        from ultralytics import YOLO
    except ImportError:
        return jsonify({"error": "pip install ultralytics for smoke inference"}), 503
    if _smoke_model is None:
        _smoke_model = YOLO(weights)
    f = request.files["image"]
    with tempfile.NamedTemporaryFile(suffix=Path(f.filename or "img.jpg").suffix or ".jpg",
                                     delete=False) as tmp:
        f.save(tmp.name)
        res = _smoke_model.predict(tmp.name, verbose=False)[0]
    os.unlink(tmp.name)
    top = int(res.probs.top1) if getattr(res, "probs", None) is not None else -1
    names = res.names or {}
    conf = float(res.probs.top1conf) if getattr(res, "probs", None) is not None else 0.0
    label = names.get(top, str(top))
    hazard = label in ("fire", "smoke", "explosion")
    return jsonify({"class": label, "confidence": round(conf, 4), "hazard": hazard})


if __name__ == "__main__":
    start_modules()
    time.sleep(1)
    print(f"[run.py] gateway :{FLASK_PORT} | twin :{TWIN_PORT} | face :{FACE_PORT} | fall :{FALL_PORT}")
    try:
        app.run(host="0.0.0.0", port=FLASK_PORT)
    finally:
        for p in _procs:
            try:
                p.terminate()
            except Exception:
                pass
