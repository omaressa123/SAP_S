# Fallwatch: Pose-Based Fall Detection

Fallwatch analyzes uploaded videos or live camera streams with MediaPipe Pose and a trained Random Forest classifier. It detects body-motion patterns associated with falls and applies a post-event stillness check to reduce false alarms.

The project includes a browser interface built with plain HTML, CSS, and JavaScript. The local Python server accepts a video upload, runs the model frame by frame, and returns event timestamps.

## Current result

The included Random Forest model was trained on the processed dataset and saved as `models/rf_fall_model.joblib`.

- Test accuracy: 0.91
- Fall precision: 0.93
- Fall recall: 0.80
- Fall F1 score: 0.86

These metrics are a small-dataset baseline, not a guarantee for a new camera position or scene.

## Run the web interface

Use Python 3.12. The current MediaPipe runtime is not stable with the original Python 3.14 environment on this machine.

```bash
python3.12 -m venv .venv312
.venv312/bin/python -m pip install -r requirements.txt
.venv312/bin/python web_app.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000), choose a video, and click **Analyze video**. Supported formats are MP4, AVI, MOV, MKV, and WebM. Uploads are limited to 250 MB and are deleted after analysis.

For the full setup, troubleshooting, and test commands, see [how to run.md](how%20to%20run.md).

## Run without the browser

```bash
.venv312/bin/python src/Realtime_infer.py \
  --model models/rf_fall_model.joblib \
  --source "/path/to/video.mp4"
```

For a webcam preview:

```bash
.venv312/bin/python src/Realtime_infer.py \
  --model models/rf_fall_model.joblib \
  --source 0 \
  --display
```

## Train the Random Forest

The current dataset layout stores annotations under `data/data`, so use that directory when building windows:

```bash
.venv312/bin/python src/Windowing.py \
  --keypoints_dir data/processed/keypoints \
  --annotations_dir data/data \
  --output data/processed/windows.npz

.venv312/bin/python src/Train_rf.py \
  --data data/processed/windows.npz \
  --out models/rf_fall_model.joblib
```

The LSTM trainer is available as an optional comparison model:

```bash
.venv312/bin/python src/Train_lstm.py \
  --data data/processed/windows.npz \
  --out models/lstm_fall_model.pt
```

## Project structure

```text
config.yaml                 Model and pipeline settings
web_app.py                  Local upload server and /api/analyze endpoint
web/index.html              Upload and result interface
web/style.css               Responsive visual design
web/app.js                  Browser upload and result rendering
src/Pose_extraction.py      Video to MediaPipe keypoints
src/Features.py             Frame-level pose features and aggregation
src/Windowing.py            Sliding windows, labels, and video-level split
src/Train_rf.py             Random Forest training and evaluation
src/Train_lstm.py           Optional LSTM training
src/Realtime_infer.py       Video, webcam, and RTSP inference
data/processed/windows.npz Prepared training/test windows
models/rf_fall_model.joblib Trained Random Forest bundle
models/pose_landmarker_lite.task
                            MediaPipe pose model asset
```

## Important limitations

- This is pose-based fall detection, not face recognition or identity recognition.
- A confirmed event means the classifier flagged a fall pattern and the person remained still during the configured confirmation period.
- The model was trained on a limited dataset. Test it with footage from the target camera, lighting, distance, and floor layout before relying on alerts.
- Frames where MediaPipe cannot detect a person are handled as missing keypoints. Improve camera placement and visibility before changing the model when detection quality is poor.
- The local server has no authentication or multi-user queue. Do not expose it directly to the public internet.

## Architecture

See [arch.md](arch.md) for the component diagram, data flow, and extension points.
