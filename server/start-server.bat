@echo off
setlocal
cd /d "%~dp0"

if not exist paper-1.21.11-116.jar (
  echo [ERRO] Coloque o arquivo paper-1.21.11-116.jar nesta pasta:
  echo %cd%
  echo.
  echo Depois execute este script novamente.
  pause
  exit /b 1
)

java -Xms2G -Xmx4G -jar paper-1.21.11-116.jar --nogui
pause
