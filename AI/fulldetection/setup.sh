#!/usr/bin/env bash
# One-shot environment setup for the fall detection project.
set -e

echo "== Fall Detection project setup =="

# 1. Create virtual environment
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment (.venv)..."
    python3 -m venv .venv
fi
source .venv/bin/activate

# 2. Install dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# 3. Create expected data folders
mkdir -p data/raw data/processed models

# 4. Check for Kaggle credentials (needed for the Le2i mirror download)
if [ ! -f "$HOME/.kaggle/kaggle.json" ]; then
    echo ""
    echo "NOTE: No Kaggle API token found at ~/.kaggle/kaggle.json."
    echo "To download the Le2i dataset you'll need one:"
    echo "  1. Go to https://www.kaggle.com/settings -> 'Create New Token'"
    echo "  2. Save the downloaded kaggle.json to ~/.kaggle/kaggle.json"
    echo "  3. chmod 600 ~/.kaggle/kaggle.json"
fi

echo ""
echo "Setup complete. Activate the environment with: source .venv/bin/activate"
echo "Then run: python data/download_dataset.py --source le2i"