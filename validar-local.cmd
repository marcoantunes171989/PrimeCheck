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

echo [1/4] Encerrando qualquer preview antigo na porta 4173...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":4173" ^| findstr "LISTENING"') do (
  echo Encerrando PID %%P...
  taskkill /PID %%P /F >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo Porta 4173 liberada.
echo.

if not exist node_modules (
  echo [2/4] Instalando dependencias...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :error
) else (
  echo [2/4] Dependencias ja instaladas.
)

echo [3/4] Gerando build local...
call npm run build
if errorlevel 1 goto :error

echo.
echo [4/4] Iniciando preview local...
echo.
echo Acesso nesta maquina:
echo   http://localhost:4173
echo.
echo Para outros dispositivos da mesma rede, use o endereco Network
echo exibido pelo Vite abaixo.
echo.
call npm run preview:lan
exit /b %errorlevel%

:error
echo.
echo [ERRO] A validacao local nao pode ser iniciada.
pause
exit /b 1
