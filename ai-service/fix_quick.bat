@echo off
echo ============================================================
echo  Suspectra Quick-Fix — installs missing runtime deps
echo ============================================================
echo.
echo This script fixes:
echo   - lpips not installed  (SAM aging falls back to OpenCV)
echo   - ninja not installed  (StyleGAN2 JIT compilation)
echo.
echo If CUDA is also missing (torch.version.cuda = None), run
echo install_gpu.bat FIRST — it reinstalls PyTorch with GPU support.
echo ============================================================
echo.

echo [1/2] Installing SAM runtime deps (lpips, ninja)...
pip install lpips ninja
if errorlevel 1 (
    echo ERROR: pip install failed. Check your internet connection.
    pause
    exit /b 1
)

echo.
echo [2/2] Verifying torch + CUDA status...
python -c "import torch; cuda=torch.cuda.is_available(); print('CUDA available:', cuda); print('torch.version.cuda:', torch.version.cuda); print('Device count:', torch.cuda.device_count())"

echo.
echo ============================================================
echo  Done. Restart the service:  start_dev.bat
echo ============================================================
pause
