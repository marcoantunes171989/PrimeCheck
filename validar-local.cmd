@echo off
setlocal EnableExtensions
title PrimeCheck - Validacao Local

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

echo [1/6] Preparando ambiente local isolado por versao...
echo.

if not exist node_modules (
  echo [2/6] Instalando dependencias...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :error
) else (
  echo [2/6] Dependencias ja instaladas.
)

echo [3/6] Limpando build e cache temporario...
if exist dist rmdir /s /q dist
if exist node_modules\.vite rmdir /s /q node_modules\.vite
echo Build anterior removido.
echo.

echo [4/6] Gerando build local limpo...
call npm run build
if errorlevel 1 goto :error

echo.
echo Validando bundle e SHA gerados...
call npm run verify:build-info
if errorlevel 1 goto :error
call npm run verify:nfce-xml-format
if errorlevel 1 goto :error
echo.

for /f "delims=" %%S in ('git rev-parse HEAD') do set "EXPECTED_SHA=%%S"
set "VITE_PRIMECHECK_SHA=%EXPECTED_SHA%"

for /f "delims=" %%P in ('powershell -NoProfile -Command "$s='%EXPECTED_SHA%'; 4200 + ([Convert]::ToInt32($s.Substring(0,4),16) %% 1000)"') do set "LOCAL_PORT=%%P"

if not defined LOCAL_PORT (
  echo [ERRO] Nao foi possivel calcular a porta local.
  pause
  exit /b 1
)

echo [5/6] Iniciando servidor local persistente...
echo SHA : %EXPECTED_SHA%
echo Porta: %LOCAL_PORT%
echo.

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%LOCAL_PORT%" ^| findstr "LISTENING"') do (
  echo Encerrando processo anterior PID %%P na porta %LOCAL_PORT%...
  taskkill /PID %%P /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

set "VITE_LOG=%TEMP%\primecheck-vite-%LOCAL_PORT%-%RANDOM%.log"
set "VITE_PID=%TEMP%\primecheck-vite-%LOCAL_PORT%-%RANDOM%.pid"

node scripts\start-local-server.mjs "%LOCAL_PORT%" "%EXPECTED_SHA%" "%VITE_LOG%" "%VITE_PID%" "%~dp0"
if errorlevel 1 (
  echo [ERRO] Falha ao iniciar o servidor local persistente.
  goto :vitelog
)

echo.
echo [6/6] Confirmando porta, HTTP, fonte e runtime no Edge...

set "PORT_READY="
for /L %%I in (1,1,30) do (
  netstat -ano | findstr ":%LOCAL_PORT%" | findstr "LISTENING" >nul 2>&1
  if not errorlevel 1 (
    set "PORT_READY=1"
    goto :portready
  )
  timeout /t 1 /nobreak >nul
)

echo [ERRO] A porta %LOCAL_PORT% nao entrou em LISTENING.
goto :vitelog

:portready
echo [OK] Porta %LOCAL_PORT% esta LISTENING.

set "SERVE_OK="
for /L %%I in (1,1,30) do (
  node scripts\verify-local-served-build.mjs "http://127.0.0.1:%LOCAL_PORT%" "%EXPECTED_SHA%" >nul 2>&1
  if not errorlevel 1 (
    set "SERVE_OK=1"
    goto :sourceok
  )
  timeout /t 1 /nobreak >nul
)

echo [ERRO] O servidor respondeu, mas nao entregou a versao esperada.
goto :vitelog

:sourceok
echo [OK] HTTP e fonte local correspondem ao SHA atual.

set "EDGE_EXE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE (
  for /f "delims=" %%E in ('where msedge 2^>nul') do if not defined EDGE_EXE set "EDGE_EXE=%%E"
)

if not defined EDGE_EXE (
  echo [ERRO] Microsoft Edge nao foi localizado.
  pause
  exit /b 1
)

set "SMOKE_DIR=%TEMP%\primecheck-edge-smoke-%RANDOM%"
set "SMOKE_FILE=%TEMP%\primecheck-edge-smoke-%RANDOM%.html"
if exist "%SMOKE_DIR%" rmdir /s /q "%SMOKE_DIR%"

"%EDGE_EXE%" --headless=new --disable-gpu --no-first-run --disable-extensions --user-data-dir="%SMOKE_DIR%" --virtual-time-budget=8000 --dump-dom "http://127.0.0.1:%LOCAL_PORT%/?smoke=%EXPECTED_SHA%" > "%SMOKE_FILE%" 2>nul

findstr /C:"PrimeCheck" "%SMOKE_FILE%" >nul
if errorlevel 1 goto :smokeerror
findstr /C:"Processamento local" "%SMOKE_FILE%" >nul
if errorlevel 1 goto :smokeerror
findstr /C:"%EXPECTED_SHA:~0,12%" "%SMOKE_FILE%" >nul
if errorlevel 1 goto :smokeerror
findstr /C:"data-primecheck-runtime-error" "%SMOKE_FILE%" >nul
if not errorlevel 1 goto :smokeerror

if exist "%SMOKE_FILE%" del /q "%SMOKE_FILE%"
if exist "%SMOKE_DIR%" rmdir /s /q "%SMOKE_DIR%"

echo [OK] Edge executou o React e confirmou a interface PrimeCheck.
echo [OK] SHA carregado: %EXPECTED_SHA%
echo.
echo ==================================================
echo HOMOLOGACAO LOCAL PRONTA
echo ==================================================
echo http://127.0.0.1:%LOCAL_PORT%/?build=%EXPECTED_SHA%
echo.
echo O processo do servidor permanecera ativo em segundo plano.
echo PID armazenado em:
echo   %VITE_PID%
echo.
start "" "http://127.0.0.1:%LOCAL_PORT%/?build=%EXPECTED_SHA%"
exit /b 0

:smokeerror
echo.
echo [ERRO] O Edge nao conseguiu montar a interface PrimeCheck.
echo Arquivo de diagnostico:
echo   %SMOKE_FILE%
echo.
type "%SMOKE_FILE%" | findstr /I /C:"data-primecheck-runtime-error" /C:"PrimeCheck"
pause
exit /b 1

:vitelog
echo.
echo ===== LOG DO SERVIDOR LOCAL =====
if exist "%VITE_LOG%" (
  type "%VITE_LOG%"
) else (
  echo Log nao encontrado: %VITE_LOG%
)
echo ===== FIM DO LOG =====
echo.
pause
exit /b 1

:error
echo.
echo [ERRO] A validacao local nao pode ser iniciada.
pause
exit /b 1
