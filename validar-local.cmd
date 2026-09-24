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

if not exist node_modules (
  echo [1/3] Instalando dependencias...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :error
) else (
  echo [1/3] Dependencias ja instaladas.
)

echo [2/3] Gerando build local...
call npm run build
if errorlevel 1 goto :error

echo.
echo [3/3] Iniciando preview local...
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
