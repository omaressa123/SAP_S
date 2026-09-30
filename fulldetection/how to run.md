# How to Run Fallwatch

## 1. Open the project

```bash
cd /home/omaressa/omar/fulldetection
```

Use the Python 3.12 virtual environment. The project also contains an older `.venv`, but the working video-inference environment is `.venv312`.

## 2. Install dependencies

Create the environment if it does not exist:

```bash
python3.12 -m venv .venv312
```

Install the dependencies:

```bash
.venv312/bin/python -m pip install -r requirements.txt
```

The MediaPipe pose asset must exist at `models/pose_landmarker_lite.task`. It is already present in the prepared project.

## 3. Start the upload interface

```bash
.venv312/bin/python web_app.py --host 127.0.0.1 --port 8000
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in a browser. Select or drag a video into the upload area, preview it, and click **Analyze video**.

The result panel displays the final decision, confirmed fall count, scanned frame count, video duration, and timestamps for flagged patterns, confirmed falls, and false alarms.

Stop the server with `Ctrl+C`.

## 4. Test from the command line

```bash
.venv312/bin/python src/Realtime_infer.py \
  --model models/rf_fall_model.joblib \
  --source "/absolute/path/to/video.mp4"
```

Use camera index `0` for a webcam. Add `--display` to show a live OpenCV preview:

```bash
.venv312/bin/python src/Realtime_infer.py \
  --model models/rf_fall_model.joblib \
  --source 0 \
  --display
```

## 5. Rebuild the training dataset

Pose keypoints must be extracted before windowing:

```bash
.venv312/bin/python src/Pose_extraction.py \
  --input_dir data/data \
  --output_dir data/processed/keypoints
```

Build windows with the annotation root that contains the dataset's `Annotation_files` folders:

```bash
.venv312/bin/python src/Windowing.py \
  --keypoints_dir data/processed/keypoints \
  --annotations_dir data/data \
  --output data/processed/windows.npz
```

The split is by video identifier, not individual frames, so nearby frames from the same video do not leak across train and test sets.

## 6. Train the model

```bash
.venv312/bin/python src/Train_rf.py \
  --data data/processed/windows.npz \
  --out models/rf_fall_model.joblib
```

The trainer prints precision, recall, F1 score, a confusion matrix, and feature importances.

Optional LSTM comparison:

```bash
.venv312/bin/python src/Train_lstm.py \
  --data data/processed/windows.npz \
  --out models/lstm_fall_model.pt
```

## Troubleshooting

### `ModuleNotFoundError`

Run commands with `.venv312/bin/python`, not the system `python` command:

```bash
.venv312/bin/python -m pip install -r requirements.txt
```

### MediaPipe segmentation fault

Use Python 3.12 and `.venv312`. The original Python 3.14 environment caused a native MediaPipe crash during video processing.

### `Could not open video source`

Check the path and codec. Try an MP4 or AVI that OpenCV can read. Paths containing spaces must be quoted.

### Many `Mean of empty slice` warnings

MediaPipe is failing to find a person in some frames. Improve lighting, camera angle, resolution, and visibility of the full body. The pipeline still handles those frames, but detection quality will be lower.

### No fall labels in the training data

Pass the directory that contains the annotation subfolders, usually `data/data`, rather than a nonexistent flat `data/raw/le2i_annotations` directory. Verify the generated file with:

```bash
.venv312/bin/python -c "import numpy as np; d=np.load('data/processed/windows.npz'); print(np.unique(d['y_train'], return_counts=True))"
```

Both classes, `0` and `1`, must be present before training.
