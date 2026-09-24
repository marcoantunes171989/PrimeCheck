@echo off
setlocal EnableExtensions
title PrimeCheck - Atualizar e Validar Local

set "PROJECT_DIR=%~dp0"
set "RUNNER_SOURCE=%PROJECT_DIR%scripts\atualizar-validar-local-runner.cmd"
set "RUNNER_TEMP=%TEMP%\PrimeCheck-atualizar-%RANDOM%-%RANDOM%.cmd"

if not exist "%RUNNER_SOURCE%" (
  echo.
  echo [ERRO] Executor de atualizacao nao encontrado:
  echo   %RUNNER_SOURCE%
  echo.
  echo A pasta local precisa receber a versao atual antes de prosseguir.
  pause
  exit /b 1
)

copy /Y "%RUNNER_SOURCE%" "%RUNNER_TEMP%" >nul
if errorlevel 1 (
  echo.
  echo [ERRO] Nao foi possivel criar o executor temporario.
  pause
  exit /b 1
)

call "%RUNNER_TEMP%" "%PROJECT_DIR%"
set "EXIT_CODE=%ERRORLEVEL%"

del /Q "%RUNNER_TEMP%" >nul 2>&1
exit /b %EXIT_CODE%
