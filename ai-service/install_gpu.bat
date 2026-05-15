@echo off
echo ============================================================
echo  Suspectra GPU Setup — installs CUDA PyTorch + all deps
echo ============================================================

echo.
echo [1/4] Checking for NVIDIA GPU...
nvidia-smi >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: nvidia-smi not found.
    echo  Either the NVIDIA driver is not installed, or this machine
    echo  has no NVIDIA GPU.  The service will fall back to CPU/OpenCV.
    echo.
    echo  If you DO have an NVIDIA GPU, install the latest driver from:
    echo    https://www.nvidia.com/drivers
    pause
    exit /b 1
)
nvidia-smi

echo.
echo [2/4] Detecting CUDA version from nvidia-smi...
python -c "import subprocess, re; out=subprocess.check_output('nvidia-smi', text=True, stderr=subprocess.STDOUT); m=re.search(r'CUDA Version:\s*(\d+)', out); v=int(m.group(1)) if m else 0; print('cu121' if v >= 12 else 'cu118')" > _cuda_whl.tmp 2>nul
set /p CUDA_WHL=<_cuda_whl.tmp
del _cuda_whl.tmp 2>nul
if "%CUDA_WHL%"=="" set CUDA_WHL=cu121
echo    Detected wheel index: %CUDA_WHL%

echo.
echo [3/4] Installing PyTorch with %CUDA_WHL% support...
pip install torch torchvision --index-url https://download.pytorch.org/whl/%CUDA_WHL%
if errorlevel 1 (
    echo ERROR: torch install failed. Check your internet connection.
    pause
    exit /b 1
)

echo.
echo [4/4] Installing SAM runtime deps + remaining requirements...
pip install lpips ninja
pip install -r requirements.txt

echo.
echo ============================================================
echo  Verifying CUDA...
python -c "import torch; cuda=torch.cuda.is_available(); print('CUDA available:', cuda); print('torch.version.cuda:', torch.version.cuda); print('GPU:', torch.cuda.get_device_name(0) if cuda else 'none')"
echo ============================================================
echo  Done. Run  start_dev.bat  to start the service.
echo ============================================================
pause
