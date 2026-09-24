@echo off
setlocal EnableExtensions
title PrimeCheck - Validacao Local

cd /d "%~dp0"
if errorlevel 1 (
  echo [ERRO] Nao foi possivel acessar a pasta do PrimeCheck.
  pause
  exit /b 1
)

echo.
echo ===============================================
echo   PrimeCheck - Homologacao Local
echo ===============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado no PATH.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERRO] npm nao encontrado no PATH.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/3] Instalando dependencias...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :error
) else (
  echo [1/3] Dependencias ja instaladas.
)

for /f "delims=" %%S in ('git rev-parse HEAD') do set "VITE_PRIMECHECK_SHA=%%S"

echo [2/3] Gerando build local...
if exist dist rmdir /s /q dist
call npm run build
if errorlevel 1 goto :error

echo.
echo [3/3] Iniciando Preview Vite local...
echo.
echo Acesso PrimeCheck nesta maquina:
echo   http://127.0.0.1:4177
echo.
echo SHA carregado:
echo   %VITE_PRIMECHECK_SHA%
echo.
echo IMPORTANTE:
echo   - mantenha esta janela aberta durante a validacao;
echo   - o Vite abaixo e o servidor local do PrimeCheck;
echo   - Ctrl+C encerra o servidor.
echo.

call npm run preview:local
exit /b %errorlevel%

:error
echo.
echo [ERRO] A validacao local nao pode ser iniciada.
pause
exit /b 1
