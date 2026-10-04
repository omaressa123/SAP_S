"""
Stage 3, Option B — small LSTM on raw per-frame sequences.

Captures temporal dynamics better than the aggregated Option A features, at the cost of
needing more data and more care against overfitting. Train this after Option A works, and
compare the two in your report.

Usage:
    python src/train_lstm.py --data data/processed/windows.npz --out models/lstm_fall_model.pt
"""

import argparse
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import classification_report, confusion_matrix

from utils import load_config


class FallLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=64, num_layers=2, dropout=0.3):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.classifier = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 2),
        )

    def forward(self, x):
        _, (h_n, _) = self.lstm(x)
        last_hidden = h_n[-1]  # (batch, hidden_size)
        return self.classifier(last_hidden)


def train_one_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss = 0.0
    for X_batch, y_batch in loader:
        X_batch, y_batch = X_batch.to(device), y_batch.to(device)
        optimizer.zero_grad()
        logits = model(X_batch)
        loss = criterion(logits, y_batch)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * X_batch.size(0)
    return total_loss / len(loader.dataset)


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    all_preds, all_labels = [], []
    for X_batch, y_batch in loader:
        X_batch = X_batch.to(device)
        logits = model(X_batch)
        preds = logits.argmax(dim=1).cpu().numpy()
        all_preds.extend(preds)
        all_labels.extend(y_batch.numpy())
    return np.array(all_labels), np.array(all_preds)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="windows.npz produced by windowing.py")
    parser.add_argument("--out", required=True, help="Path to save the trained model (.pt)")
    parser.add_argument("--config", default="config.yaml")
    args = parser.parse_args()

    cfg = load_config(args.config) if Path(args.config).exists() else {}
    lstm_cfg = cfg.get("classifier", {}).get("lstm", {})

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    data = np.load(args.data, allow_pickle=True)
    X_train, y_train = data["X_seq_train"], data["y_train"]
    X_test, y_test = data["X_seq_test"], data["y_test"]

    print(f"Train: {X_train.shape}, Test: {X_test.shape}")
    print(f"Class balance — train: {np.bincount(y_train)}, test: {np.bincount(y_test)}")

    train_ds = TensorDataset(torch.tensor(X_train, dtype=torch.float32), torch.tensor(y_train, dtype=torch.long))
    test_ds = TensorDataset(torch.tensor(X_test, dtype=torch.float32), torch.tensor(y_test, dtype=torch.long))

    batch_size = lstm_cfg.get("batch_size", 16)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False)

    input_size = X_train.shape[-1]  # number of per-frame features (4: aspect_ratio, centroid_y, torso_angle, velocity)
    model = FallLSTM(
        input_size=input_size,
        hidden_size=lstm_cfg.get("hidden_size", 64),
        num_layers=lstm_cfg.get("num_layers", 2),
        dropout=lstm_cfg.get("dropout", 0.3),
    ).to(device)

    # Class-weighted loss to counter fall/not-fall imbalance
    class_counts = np.bincount(y_train, minlength=2)
    class_weights = torch.tensor(
        [1.0 / max(c, 1) for c in class_counts], dtype=torch.float32
    )
    class_weights = class_weights / class_weights.sum() * 2
    criterion = nn.CrossEntropyLoss(weight=class_weights.to(device))
    optimizer = torch.optim.Adam(model.parameters(), lr=lstm_cfg.get("learning_rate", 0.001))

    epochs = lstm_cfg.get("epochs", 40)
    for epoch in range(1, epochs + 1):
        loss = train_one_epoch(model, train_loader, optimizer, criterion, device)
        if epoch % 5 == 0 or epoch == epochs:
            print(f"Epoch {epoch}/{epochs} — loss: {loss:.4f}")

    y_true, y_pred = evaluate(model, test_loader, device)
    print("\n=== Test set performance ===")
    print(classification_report(y_true, y_pred, target_names=["not-fall", "fall"]))
    print("Confusion matrix:")
    print(confusion_matrix(y_true, y_pred))

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "input_size": input_size,
            "hidden_size": lstm_cfg.get("hidden_size", 64),
            "num_layers": lstm_cfg.get("num_layers", 2),
            "dropout": lstm_cfg.get("dropout", 0.3),
        },
        out_path,
    )
    print(f"\nModel saved to {out_path}")


if __name__ == "__main__":
    main()