#!/usr/bin/env bash
set -e

echo "============================================================"
echo " Suspectra GPU Setup — installs CUDA PyTorch then deps"
echo "============================================================"

echo ""
echo "[1/3] Checking NVIDIA driver..."
if ! command -v nvidia-smi &>/dev/null; then
    echo "ERROR: nvidia-smi not found. Is the NVIDIA driver installed?"
    exit 1
fi
nvidia-smi --query-gpu=name,driver_version --format=csv,noheader

echo ""
echo "[2/3] Installing PyTorch with CUDA 12.1 support..."
echo "      (edit this file and change cu121→cu118 for older GPUs)"
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

echo ""
echo "[3/3] Installing remaining dependencies..."
pip install -r requirements.txt

echo ""
echo "============================================================"
echo " Verifying CUDA..."
python -c "
import torch
cuda = torch.cuda.is_available()
print('CUDA available:', cuda)
print('torch.version.cuda:', torch.version.cuda)
print('GPU:', torch.cuda.get_device_name(0) if cuda else 'none')
"
echo "============================================================"
echo " Done. Start the service with: uvicorn main:app --reload"
echo "============================================================"
