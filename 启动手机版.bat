@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8080
set "PY=C:\Users\86158\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
if not exist "%PY%" set "PY=python"
echo ==========================================
echo 像素撤离 手机版
echo 手机和电脑必须连接同一个 Wi-Fi。
echo 下面列出的 IPv4 地址就是电脑地址：
ipconfig | findstr /i "IPv4"
echo.
echo 手机访问: http://电脑IPv4地址:%PORT%/index.html
echo 电脑访问: http://127.0.0.1:%PORT%/index.html
echo ==========================================
start "" "http://127.0.0.1:%PORT%/index.html"
"%PY%" -m http.server %PORT% --bind 0.0.0.0
pause
