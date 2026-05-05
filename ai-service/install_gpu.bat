@echo off
echo ============================================================
echo  Suspectra GPU Setup — installs CUDA PyTorch then deps
echo ============================================================

echo.
echo [1/3] Detecting CUDA version...
nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>nul
if errorlevel 1 (
    echo ERROR: nvidia-smi not found. Is the NVIDIA driver installed?
    pause
    exit /b 1
)

echo.
echo [2/3] Installing PyTorch with CUDA 12.1 support...
echo       (use install_gpu_cu118.bat if your driver is older)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
if errorlevel 1 (
    echo ERROR: torch install failed.
    pause
    exit /b 1
)

echo.
echo [3/3] Installing remaining dependencies...
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
echo  Done. Start the service with: uvicorn main:app --reload
echo ============================================================
pause
