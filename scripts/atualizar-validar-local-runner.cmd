@echo off
setlocal EnableExtensions
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
echo Executor seguro: copia temporaria fora do repositorio.
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Git nao encontrado no PATH.
  pause
  exit /b 1
)

for /f "delims=" %%i in ('git status --porcelain 2^>nul') do (
  echo [ERRO] Existem alteracoes locais nao salvas neste repositorio.
  echo.
  git status --short
  echo.
  echo Salve, descarte ou faca commit dessas alteracoes antes de atualizar.
  pause
  exit /b 1
)

echo [1/8] Validando repositorio e buscando homologacao...
for /f "delims=" %%O in ('git remote get-url origin') do set "ORIGIN_URL=%%O"
echo Repositorio: %ORIGIN_URL%
echo %ORIGIN_URL% | findstr /I /C:"marcoantunes171989/PrimeCheck" >nul
if errorlevel 1 (
  echo [ERRO] Esta pasta nao aponta para o repositorio oficial PrimeCheck.
  echo Origem encontrada: %ORIGIN_URL%
  pause
  exit /b 1
)

git fetch origin homologacao-local-validacao --prune
if errorlevel 1 goto :giterror

echo [2/8] Posicionando a branch local exatamente na homologacao remota...
git checkout -B homologacao-local-validacao origin/homologacao-local-validacao
if errorlevel 1 goto :giterror

echo [3/8] Sincronizando exatamente com a homologacao remota...
git reset --hard origin/homologacao-local-validacao
if errorlevel 1 goto :giterror

echo [4/8] Versao carregada:
git log -1 --oneline
echo.

echo [5/8] Confirmando SHA local = remoto...
for /f "delims=" %%L in ('git rev-parse HEAD') do set "LOCAL_SHA=%%L"
for /f "delims=" %%R in ('git rev-parse origin/homologacao-local-validacao') do set "REMOTE_SHA=%%R"
if /I not "%LOCAL_SHA%"=="%REMOTE_SHA%" (
  echo [ERRO] Branch local diferente da homologacao remota.
  echo Local : %LOCAL_SHA%
  echo Remoto: %REMOTE_SHA%
  pause
  exit /b 1
)
echo [OK] SHA local e remoto confirmados: %LOCAL_SHA%
echo.

echo [6/8] Confirmando menu NFC-e "Pesquisa por produtos"...
findstr /C:"label: 'Pesquisa por produtos'" "src\components\Sidebar.tsx" >nul
if errorlevel 1 (
  echo [ERRO] A branch carregada nao contem o menu "Pesquisa por produtos".
  echo Atualizacao interrompida para evitar validar uma versao incorreta.
  pause
  exit /b 1
)
echo [OK] Menu "Pesquisa por produtos" confirmado no codigo-fonte.
echo.

echo [7/8] Confirmando tela Consulta de produtos...
findstr /C:": 'Consulta de produtos'" "src\pages\NfceAnalyticsPage.tsx" >nul
if errorlevel 1 (
  echo [ERRO] A tela atual nao contem o titulo "Consulta de produtos".
  pause
  exit /b 1
)
findstr /C:"value=\"over8\"" "src\pages\NfceAnalyticsPage.tsx" >nul
if errorlevel 1 (
  echo [ERRO] O filtro para codigos maiores que 8 digitos nao foi encontrado.
  pause
  exit /b 1
)
echo [OK] Tela e filtros novos confirmados no codigo-fonte.
echo.

echo [8/8] Iniciando validacao local...
echo.
call "%PROJECT_DIR%validar-local.cmd"
exit /b %errorlevel%

:giterror
echo.
echo [ERRO] Nao foi possivel atualizar a homologacao local com seguranca.
echo Nenhum merge automatico foi realizado.
echo Envie um print desta tela para analise antes de continuar.
pause
exit /b 1
