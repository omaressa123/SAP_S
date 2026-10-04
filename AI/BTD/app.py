"""X-ray baggage threat detection — Hugging Face Space entrypoint."""
import json
import gradio as gr
from ultralytics import YOLO

model = YOLO("best.pt")

# Single source of truth: the names baked into the checkpoint at training time.
# res.plot() draws box labels from model.names internally, so reading the text table
# from a separate classes.json risked the image and the table disagreeing with each
# other whenever the two drifted apart. classes.json is now only a cross-check.
CLASSES = [model.names[i] for i in sorted(model.names)]
_expected = json.load(open("classes.json"))["names"]
if CLASSES != _expected:
    raise SystemExit(
        "FATAL: checkpoint class names do not match classes.json.\n"
        f"  checkpoint: {CLASSES}\n  classes.json: {_expected}\n"
        "Every prediction would be mislabelled. Re-export both from the same run."
    )

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

if __name__ == "__main__":
    demo.launch()
