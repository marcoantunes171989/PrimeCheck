@echo off
setlocal
title PrimeCheck - Validacao Local

echo.
echo ===============================================
echo   PrimeCheck - Homologacao Local
echo ===============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado no PATH.
  echo Instale/configure o Node.js e execute novamente.
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
echo O servidor antigo da porta 4173 nao sera reutilizado.
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

echo [5/6] Iniciando servidor local Vite sem service worker...
echo.
for /f "delims=" %%S in ('git rev-parse HEAD') do set "EXPECTED_SHA=%%S"
set "VITE_PRIMECHECK_SHA=%EXPECTED_SHA%"

for /f "delims=" %%P in ('powershell -NoProfile -Command "$s='%EXPECTED_SHA%'; 4200 + ([Convert]::ToInt32($s.Substring(0,4),16) %% 1000)"') do set "LOCAL_PORT=%%P"

echo Porta exclusiva desta versao: %LOCAL_PORT%
echo.
echo Encerrando qualquer processo antigo somente nesta porta...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%LOCAL_PORT%" ^| findstr "LISTENING"') do (
  echo Encerrando PID %%P...
  taskkill /PID %%P /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo.
echo Acesso desta versao:
echo   http://localhost:%LOCAL_PORT%
echo.
echo NAO USE http://localhost:4173 para esta homologacao.
echo O modo local usa uma porta exclusiva por SHA para impedir versao antiga.
echo.

set "VITE_LOG=%TEMP%\primecheck-vite-%LOCAL_PORT%-%RANDOM%.log"
set "VITE_LAUNCHER=%~dp0scripts\iniciar-vite-local.cmd"

if not exist "%VITE_LAUNCHER%" (
  echo [ERRO] Launcher do Vite nao encontrado:
  echo   %VITE_LAUNCHER%
  pause
  exit /b 1
)

start "PrimeCheck Local %LOCAL_PORT%" /min cmd /c call "%VITE_LAUNCHER%" "%LOCAL_PORT%" "%EXPECTED_SHA%" "%VITE_LOG%"

echo.
echo [6/6] Confirmando porta, fonte servida e smoke test no Edge...
set "PORT_READY="
for /L %%I in (1,1,20) do (
  netstat -ano | findstr ":%LOCAL_PORT%" | findstr "LISTENING" >nul 2>&1
  if not errorlevel 1 (
    set "PORT_READY=1"
    goto :portready
  )
  timeout /t 1 /nobreak >nul
)

echo [ERRO] A porta %LOCAL_PORT% nao entrou em estado LISTENING.
echo.
echo ===== LOG DO VITE =====
if exist "%VITE_LOG%" (
  type "%VITE_LOG%"
) else (
  echo Arquivo de log nao foi criado: %VITE_LOG%
)
echo ===== FIM DO LOG =====
pause
exit /b 1

:portready
echo [OK] Porta %LOCAL_PORT% esta LISTENING.
set "SERVE_OK="
for /L %%I in (1,1,30) do (
  node scripts\verify-local-served-build.mjs "http://localhost:%LOCAL_PORT%" "%EXPECTED_SHA%" >nul 2>&1
  if not errorlevel 1 (
    set "SERVE_OK=1"
    goto :sourceok
  )
  timeout /t 1 /nobreak >nul
)

echo [ERRO] O Vite local nao entregou a versao esperada.
echo SHA esperado: %EXPECTED_SHA%
echo.
echo ===== LOG DO VITE =====
if exist "%VITE_LOG%" (
  type "%VITE_LOG%"
) else (
  echo Arquivo de log nao foi criado: %VITE_LOG%
)
echo ===== FIM DO LOG =====
echo.
node scripts\verify-local-served-build.mjs "http://localhost:%LOCAL_PORT%" "%EXPECTED_SHA%"
pause
exit /b 1

:sourceok
echo [OK] Fonte local corresponde ao SHA atual.
echo.

set "EDGE_EXE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE (
  for /f "delims=" %%E in ('where msedge 2^>nul') do if not defined EDGE_EXE set "EDGE_EXE=%%E"
)

if not defined EDGE_EXE (
  echo [ERRO] Microsoft Edge nao foi localizado para o teste real da interface.
  echo A homologacao nao sera liberada sem validar a montagem do React.
  pause
  exit /b 1
)

set "SMOKE_DIR=%TEMP%\primecheck-edge-smoke-%RANDOM%"
set "SMOKE_FILE=%TEMP%\primecheck-edge-smoke-%RANDOM%.html"
if exist "%SMOKE_DIR%" rmdir /s /q "%SMOKE_DIR%"

"%EDGE_EXE%" --headless=new --disable-gpu --no-first-run --disable-extensions --user-data-dir="%SMOKE_DIR%" --virtual-time-budget=7000 --dump-dom "http://localhost:%LOCAL_PORT%/?smoke=%EXPECTED_SHA%" > "%SMOKE_FILE%" 2>nul

findstr /C:"PrimeCheck" "%SMOKE_FILE%" >nul
if errorlevel 1 goto :smokeerror
findstr /C:"Processamento local" "%SMOKE_FILE%" >nul
if errorlevel 1 goto :smokeerror
findstr /C:"Pesquisa por produtos" "%SMOKE_FILE%" >nul
if errorlevel 1 goto :smokeerror
findstr /C:"Consulta de produtos" "%SMOKE_FILE%" >nul
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
echo Acesso validado:
echo   http://localhost:%LOCAL_PORT%/?build=%EXPECTED_SHA%
echo.
start "" "http://localhost:%LOCAL_PORT%/?build=%EXPECTED_SHA%"
exit /b 0

:smokeerror
echo.
echo [ERRO] O Edge nao conseguiu montar a interface PrimeCheck.
echo A homologacao foi bloqueada para evitar uma tela branca.
echo Arquivo de diagnostico:
echo   %SMOKE_FILE%
echo.
type "%SMOKE_FILE%" | findstr /I /C:"data-primecheck-runtime-error" /C:"PrimeCheck"
pause
exit /b 1

:error
echo.
echo [ERRO] A validacao local nao pode ser iniciada.
pause
exit /b 1
