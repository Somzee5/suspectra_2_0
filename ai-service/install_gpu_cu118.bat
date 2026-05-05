@echo off
echo ============================================================
echo  Suspectra GPU Setup — CUDA 11.8 (older GPUs / drivers)
echo ============================================================

echo.
echo [1/2] Installing PyTorch with CUDA 11.8 support...
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
if errorlevel 1 (
    echo ERROR: torch install failed.
    pause
    exit /b 1
)

echo.
echo [2/2] Installing remaining dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: requirements install failed.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  Verifying CUDA...
python -c "import torch; cuda=torch.cuda.is_available(); print('CUDA available:', cuda); print('torch.version.cuda:', torch.version.cuda); print('GPU:', torch.cuda.get_device_name(0) if cuda else 'none')"
echo ============================================================
pause
