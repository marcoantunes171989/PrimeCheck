@echo off
setlocal EnableExtensions EnableDelayedExpansion
title PrimeCheck - Atualizar e Validar Local

set "PROJECT_DIR=%~1"
if not defined PROJECT_DIR (
  echo [ERRO] Pasta do projeto nao informada ao executor.
  exit /b 1
)

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
  echo [ERRO] Nao foi possivel acessar:
  echo   %PROJECT_DIR%
  exit /b 1
)

echo.
echo ==================================================
echo   PrimeCheck - Atualizacao + Homologacao Local
echo ==================================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Git nao encontrado no PATH.
  pause
  exit /b 1
)

for /f "delims=" %%i in ('git status --porcelain 2^>nul') do (
  echo [ERRO] Existem arquivos locais diferentes do repositorio.
  echo.
  git status --short
  echo.
  echo A atualizacao foi bloqueada para nao apagar alteracoes locais.
  echo Salve, descarte ou faca commit antes de continuar.
  pause
  exit /b 1
)

echo [1/10] Validando repositorio e buscando referencias oficiais...
for /f "delims=" %%O in ('git remote get-url origin') do set "ORIGIN_URL=%%O"
echo Repositorio: %ORIGIN_URL%
echo %ORIGIN_URL% | findstr /I /C:"marcoantunes171989/PrimeCheck" >nul
if errorlevel 1 (
  echo [ERRO] Esta pasta nao aponta para o repositorio oficial PrimeCheck.
  pause
  exit /b 1
)

git fetch origin --prune
if errorlevel 1 goto :giterror

git show-ref --verify --quiet refs/remotes/origin/main
if errorlevel 1 goto :giterror
git show-ref --verify --quiet refs/remotes/origin/homologacao-local-validacao
if errorlevel 1 goto :giterror
git show-ref --verify --quiet refs/remotes/origin/production-release
if errorlevel 1 (
  echo [ERRO] Marcador production-release nao encontrado.
  echo Nao e seguro validar sem saber qual versao esta em producao.
  pause
  exit /b 1
)

echo [2/10] Posicionando a pasta na homologacao remota...
git checkout -B homologacao-local-validacao origin/homologacao-local-validacao
if errorlevel 1 goto :giterror

echo [3/10] Sincronizando arquivos rastreados exatamente com o remoto...
git reset --hard origin/homologacao-local-validacao
if errorlevel 1 goto :giterror

echo [4/10] Confirmando integridade da pasta local...
for /f "delims=" %%L in ('git rev-parse HEAD') do set "LOCAL_SHA=%%L"
for /f "delims=" %%R in ('git rev-parse origin/homologacao-local-validacao') do set "REMOTE_SHA=%%R"
for /f "delims=" %%M in ('git rev-parse origin/main') do set "MAIN_SHA=%%M"
for /f "delims=" %%P in ('git rev-parse origin/production-release') do set "PRODUCTION_SHA=%%P"

if /I not "%LOCAL_SHA%"=="%REMOTE_SHA%" (
  echo [ERRO] SHA local diferente da homologacao remota.
  echo Local : %LOCAL_SHA%
  echo Remoto: %REMOTE_SHA%
  pause
  exit /b 1
)

for /f "delims=" %%i in ('git status --porcelain') do (
  echo [ERRO] A pasta continua diferente do repositorio apos a sincronizacao.
  git status --short
  pause
  exit /b 1
)

echo [OK] Pasta local = homologacao remota: %LOCAL_SHA%
echo.

echo [5/10] Confirmando cadeia Producao ^> Main ^> Homologacao...
git merge-base --is-ancestor origin/production-release origin/main
if errorlevel 1 (
  echo [ERRO] A main nao descende do marcador de producao.
  echo Producao: %PRODUCTION_SHA%
  echo Main    : %MAIN_SHA%
  pause
  exit /b 1
)

git merge-base --is-ancestor origin/main origin/homologacao-local-validacao
if errorlevel 1 (
  echo [ERRO] A homologacao nao contem integralmente a main.
  echo Main       : %MAIN_SHA%
  echo Homologacao: %REMOTE_SHA%
  pause
  exit /b 1
)

for /f "delims=" %%C in ('git rev-list --count origin/production-release..origin/homologacao-local-validacao') do set "PENDING_PRODUCTION=%%C"
for /f "delims=" %%C in ('git rev-list --count origin/main..origin/homologacao-local-validacao') do set "PENDING_MAIN=%%C"

echo [OK] Cadeia de versoes consistente.
echo.
echo   PRODUCAO : %PRODUCTION_SHA%
echo   MAIN     : %MAIN_SHA%
echo   LOCAL    : %LOCAL_SHA%
echo   Pendentes para producao: %PENDING_PRODUCTION%
echo   Pendentes para main    : %PENDING_MAIN%
echo.

> ".git\primecheck-sync-state.txt" (
  echo production=%PRODUCTION_SHA%
  echo main=%MAIN_SHA%
  echo homologation=%REMOTE_SHA%
  echo local=%LOCAL_SHA%
  echo pending_production=%PENDING_PRODUCTION%
  echo pending_main=%PENDING_MAIN%
  echo checked_at=%DATE% %TIME%
)

echo [6/10] Confirmando bloqueio de login...
findstr /C:"PrimeCheckAuthGate" "src\main.tsx" >nul
if errorlevel 1 (
  echo [ERRO] AuthGate nao encontrado no bootstrap.
  pause
  exit /b 1
)
findstr /C:"CURRENT_BUILD_SHA" "src\components\PrimeCheckAuthGate.tsx" >nul
if errorlevel 1 (
  echo [ERRO] Trava de sessao por SHA nao encontrada.
  pause
  exit /b 1
)
echo [OK] Login e sessao vinculada ao build confirmados.
echo.

echo [7/10] Confirmando menu NFC-e "Pesquisa por produtos"...
findstr /C:"label: 'Pesquisa por produtos'" "src\components\Sidebar.tsx" >nul
if errorlevel 1 (
  echo [ERRO] Menu esperado nao encontrado.
  pause
  exit /b 1
)
echo [OK] Menu confirmado.
echo.

echo [8/10] Confirmando tela Consulta de produtos...
findstr /C:": 'Consulta de produtos'" "src\pages\NfceAnalyticsPage.tsx" >nul
if errorlevel 1 (
  echo [ERRO] Tela Consulta de produtos nao encontrada.
  pause
  exit /b 1
)
echo [OK] Tela confirmada.
echo.

echo [9/10] Exportando estado de versao para o build local...
set "VITE_PRIMECHECK_SHA=%LOCAL_SHA%"
set "VITE_PRIMECHECK_PRODUCTION_SHA=%PRODUCTION_SHA%"
set "VITE_PRIMECHECK_MAIN_SHA=%MAIN_SHA%"
set "VITE_PRIMECHECK_PENDING_COMMITS=%PENDING_PRODUCTION%"

echo [10/10] Iniciando validacao local segura...
echo.
call "%PROJECT_DIR%validar-local.cmd"
exit /b %errorlevel%

:giterror
echo.
echo [ERRO] Nao foi possivel sincronizar o PrimeCheck com seguranca.
echo Nenhum merge automatico foi realizado.
pause
exit /b 1
