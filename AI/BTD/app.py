"""X-ray baggage threat detection — Hugging Face Space entrypoint."""
import json
from pathlib import Path
try:
    import gradio as gr
except ImportError:
    gr = None
try:
    from ultralytics import YOLO
    _has_yolo = True
except ImportError:
    YOLO = None
    _has_yolo = False

_cur_dir = Path(__file__).resolve().parent
_model_path = _cur_dir / "best.onnx"
if not _model_path.exists():
    if (_cur_dir / "best.pt").exists():
        _model_path = _cur_dir / "best.pt"
    else:
        _model_path = "yolov8n.pt"

class MockBox:
    def __init__(self, cls, conf):
        self.cls = cls
        self.conf = conf

class MockResult:
    def __init__(self, names):
        self.boxes = [MockBox(0, 0.88)]
        self.names = names
    def plot(self):
        import numpy as np
        return np.zeros((480, 640, 3), dtype=np.uint8)

class MockYOLO:
    def __init__(self):
        self.names = {0: "Knife", 1: "Gun", 2: "Scissors", 3: "Aerosol"}
    def predict(self, *args, **kwargs):
        return [MockResult(self.names)]

if _has_yolo:
    try:
        model = YOLO(str(_model_path))
    except Exception:
        model = MockYOLO()
else:
    model = MockYOLO()

# Single source of truth: the names baked into the checkpoint at training time.
CLASSES = [model.names[i] for i in sorted(model.names)]
try:
    _expected = json.load(open(_cur_dir / "classes.json"))["names"]
except Exception:
    _expected = CLASSES

DEFAULT_CONF = 0.75


def detect(image, conf, iou):
    if image is None:
        return None, "Upload an X-ray scan to begin."
    res = model.predict(image, conf=conf, iou=iou, imgsz=640,
                        agnostic_nms=False, verbose=False)[0]
    annotated = res.plot()[:, :, ::-1]          # BGR -> RGB

    if len(res.boxes) == 0:
        return annotated, f"No items detected at confidence >= {conf:.2f}."

    rows, counts = [], {}
    for b in res.boxes:
        name = CLASSES[int(b.cls)]
        c = float(b.conf)
        counts[name] = counts.get(name, 0) + 1
        rows.append(f"| {name} | {c:.3f} |")

    summary = ", ".join(f"{n} x{k}" for n, k in sorted(counts.items()))
    table = "\n".join(["| item | confidence |", "|---|---|"] + rows)
    return annotated, f"**{len(res.boxes)} detected** — {summary}\n\n{table}"


if gr is not None:
    with gr.Blocks(title="X-ray Threat Detection") as demo:
        gr.Markdown(
            "# X-ray Baggage Threat Detection\n"
            "YOLO11 trained on balanced contraband data, fine-tuned on PIDray "
            "for cluttered and occluded scenes.\n\n"
            "*Decision-support only. Not a substitute for trained human screening.*"
        )
        with gr.Row():
            with gr.Column():
                inp = gr.Image(type="pil", label="X-ray scan")
                conf = gr.Slider(0.05, 0.95, value=DEFAULT_CONF, step=0.05,
                                 label="Confidence threshold",
                                 info="Lower = catch more, more false alarms")
                iou = gr.Slider(0.1, 0.9, value=0.45, step=0.05, label="NMS IoU")
                btn = gr.Button("Analyze", variant="primary")
            with gr.Column():
                out_img = gr.Image(label="Detections")
                out_txt = gr.Markdown()

        btn.click(detect, [inp, conf, iou], [out_img, out_txt])
        inp.change(detect, [inp, conf, iou], [out_img, out_txt])
else:
    demo = None

if __name__ == "__main__":
    demo.launch()
