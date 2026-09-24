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

echo [1/6] Encerrando qualquer preview antigo na porta 4173...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":4173" ^| findstr "LISTENING"') do (
  echo Encerrando PID %%P...
  taskkill /PID %%P /F >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo Porta 4173 liberada.
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

echo [5/6] Iniciando preview local...
echo.
echo Acesso nesta maquina:
echo   http://localhost:4173
echo.
echo Para outros dispositivos da mesma rede, use o endereco Network
echo exibido pelo Vite abaixo.
echo.
for /f "delims=" %%S in ('git rev-parse HEAD') do set "EXPECTED_SHA=%%S"

start "PrimeCheck Preview" /min cmd /c "cd /d ""%~dp0"" && npm run preview:lan"

echo.
echo [6/6] Confirmando versao realmente servida em localhost:4173...
set "SERVE_OK="
for /L %%I in (1,1,20) do (
  powershell -NoProfile -Command "$ErrorActionPreference='Stop'; $i=Invoke-RestMethod ('http://127.0.0.1:4173/build-info.json?ts=' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()); if ($i.sha -eq '%EXPECTED_SHA%') { exit 0 } else { Write-Host ('SHA servido: ' + $i.sha); exit 2 }" >nul 2>&1
  if not errorlevel 1 (
    set "SERVE_OK=1"
    goto :serverready
  )
  timeout /t 1 /nobreak >nul
)

echo [ERRO] O localhost:4173 nao confirmou o SHA atual.
echo Esperado: %EXPECTED_SHA%
echo A homologacao NAO sera considerada liberada.
pause
exit /b 1

:serverready
echo [OK] localhost:4173 esta servindo exatamente o SHA:
echo      %EXPECTED_SHA%
echo.
echo Acesso:
echo   http://localhost:4173/?build=%EXPECTED_SHA%
echo.
start "" "http://localhost:4173/?build=%EXPECTED_SHA%"
exit /b 0

:error
echo.
echo [ERRO] A validacao local nao pode ser iniciada.
pause
exit /b 1
