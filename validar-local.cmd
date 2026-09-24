@echo off
setlocal EnableExtensions
title PrimeCheck - Homologacao Local

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

echo [1/5] Preparando ambiente...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":4177" ^| findstr "LISTENING"') do (
  echo Encerrando servidor anterior PID %%P na porta 4177...
  taskkill /PID %%P /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

if not exist node_modules (
  echo [2/5] Instalando dependencias...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :error
) else (
  echo [2/5] Dependencias ja instaladas.
)

echo [3/5] Limpando build e cache do Vite...
if exist dist rmdir /s /q dist
if exist node_modules\.vite rmdir /s /q node_modules\.vite

echo [4/5] Gerando e validando build...
call npm run build
if errorlevel 1 goto :error
call npm run verify:build-info
if errorlevel 1 goto :error
call npm run verify:nfce-menu-label
if errorlevel 1 goto :error
call npm run verify:nfce-xml-format
if errorlevel 1 goto :error

for /f "delims=" %%S in ('git rev-parse HEAD') do set "EXPECTED_SHA=%%S"
set "VITE_PRIMECHECK_SHA=%EXPECTED_SHA%"

echo.
echo [5/5] Iniciando PrimeCheck em primeiro plano...
echo.
echo SHA atual:
echo   %EXPECTED_SHA%
echo.
echo Acesso local:
echo   http://127.0.0.1:4177/?build=%EXPECTED_SHA%
echo.
echo IMPORTANTE:
echo   - mantenha esta janela CMD aberta durante a validacao;
echo   - para encerrar o servidor, pressione Ctrl+C;
echo   - o navegador sera aberto automaticamente pelo Vite.
echo.
echo ===============================================
echo   SERVIDOR LOCAL INICIANDO
echo ===============================================
echo.

call npm run serve:local -- --host 127.0.0.1 --port 4173 --open "/?build=%EXPECTED_SHA%"
set "SERVER_EXIT=%ERRORLEVEL%"

echo.
echo O servidor local foi encerrado.
echo Codigo de saida: %SERVER_EXIT%
if not "%SERVER_EXIT%"=="0" (
  echo [ERRO] O Vite encerrou com falha.
  pause
)
exit /b %SERVER_EXIT%

:error
echo.
echo [ERRO] A homologacao local nao pode ser iniciada.
pause
exit /b 1
