@echo off
setlocal EnableExtensions EnableDelayedExpansion
title PrimeCheck - Validacao Local

cd /d "%~dp0"
if errorlevel 1 (
  echo [ERRO] Nao foi possivel acessar a pasta do PrimeCheck.
  pause
  exit /b 1
)

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
where git >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Git nao encontrado no PATH.
  pause
  exit /b 1
)

for /f "delims=" %%S in ('git rev-parse HEAD') do set "LOCAL_SHA=%%S"
for /f "delims=" %%S in ('git rev-parse origin/homologacao-local-validacao') do set "REMOTE_SHA=%%S"
for /f "delims=" %%S in ('git rev-parse origin/main') do set "MAIN_SHA=%%S"
for /f "delims=" %%S in ('git rev-parse origin/production-release') do set "PRODUCTION_SHA=%%S"

if /I not "%LOCAL_SHA%"=="%REMOTE_SHA%" (
  echo [ERRO] Esta pasta nao esta na ultima homologacao remota.
  echo Execute atualizar-validar-local.cmd.
  pause
  exit /b 1
)

for /f "delims=" %%C in ('git rev-list --count origin/production-release..HEAD') do set "PENDING_PRODUCTION=%%C"

set "VITE_PRIMECHECK_SHA=%LOCAL_SHA%"
set "VITE_PRIMECHECK_PRODUCTION_SHA=%PRODUCTION_SHA%"
set "VITE_PRIMECHECK_MAIN_SHA=%MAIN_SHA%"
set "VITE_PRIMECHECK_PENDING_COMMITS=%PENDING_PRODUCTION%"

echo.
echo ===============================================
echo   PrimeCheck - Homologacao Local Verificada
echo ===============================================
echo   Producao : %PRODUCTION_SHA%
echo   Main     : %MAIN_SHA%
echo   Local    : %LOCAL_SHA%
echo   Pendentes: %PENDING_PRODUCTION%
echo ===============================================
echo.

echo [1/4] Sincronizando dependencias...
call npm install --no-audit --no-fund
if errorlevel 1 goto :error

echo [2/4] Limpando artefatos e caches gerados...
if exist dist rmdir /s /q dist
if exist node_modules\.vite rmdir /s /q node_modules\.vite

echo [3/4] Gerando e auditando o build local...
call npm run build
if errorlevel 1 goto :error
node scripts\verify-local-sync.mjs
if errorlevel 1 goto :error

echo.
echo [4/4] Iniciando Vite Preview na versao auditada...
echo.
echo Acesso PrimeCheck:
echo   http://127.0.0.1:4177/
echo.
echo Mantenha esta janela aberta. Ctrl+C encerra o servidor.
echo.

call npm run preview:local
exit /b %errorlevel%

:error
echo.
echo [ERRO] A homologacao local foi bloqueada por falha de integridade.
pause
exit /b 1
