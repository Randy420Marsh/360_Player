@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Resolve directory of this script
set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

echo Activating virtual environment...

REM Check for venv existence
if not exist "%SCRIPT_DIR%\.360\Scripts\activate" (
    echo [INFO] No venv found. Creating one with uv...
    uv venv "%SCRIPT_DIR%\.360" --python 3.12
) else (
    echo [INFO] Venv found. Proceeding...
)

REM Activate venv
call "%SCRIPT_DIR%\.360\Scripts\activate"

REM Install requirements
uv pip install -r "%SCRIPT_DIR%\requirements.txt"

echo Virtual environment activated.
echo.
echo Python:
python --version

echo.
echo Pip:
pip --version

echo.
echo Use 'deactivate' to exit.
echo.

python -s "%SCRIPT_DIR%\server.py"

endlocal
