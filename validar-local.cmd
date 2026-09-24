@echo off
setlocal EnableExtensions
title PrimeCheck - Homologacao Local

cd /d "%~dp0"
if errorlevel 1 (
  echo [ERRO] Nao foi possivel acessar a pasta do PrimeCheck.
  pause
  exit /b 1
)

where powershell >nul 2>&1
if errorlevel 1 (
  echo [ERRO] PowerShell nao encontrado.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\primecheck-local.ps1" -ProjectDir "%~dp0"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERRO] A homologacao local falhou. Codigo: %EXIT_CODE%
  pause
)

exit /b %EXIT_CODE%
