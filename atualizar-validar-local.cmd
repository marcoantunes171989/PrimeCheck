@echo off
setlocal EnableExtensions
title PrimeCheck - Atualizar e Validar Local

cd /d "%~dp0"

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
  echo [ERRO] Existem alteracoes locais nao salvas neste repositorio.
  echo.
  git status --short
  echo.
  echo Salve, descarte ou faça commit dessas alteracoes antes de atualizar.
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

echo [2/8] Abrindo a branch de homologacao local...
git show-ref --verify --quiet refs/heads/homologacao-local-validacao
if errorlevel 1 (
  git switch -c homologacao-local-validacao --track origin/homologacao-local-validacao
) else (
  git switch homologacao-local-validacao
)
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
findstr /C:"Maior que 8 dígitos" "src\pages\NfceAnalyticsPage.tsx" >nul
if errorlevel 1 (
  echo [ERRO] Os filtros novos da consulta de produtos nao foram encontrados.
  pause
  exit /b 1
)
echo [OK] Tela e filtros novos confirmados no codigo-fonte.
echo.

echo [8/8] Iniciando validacao local...
echo.
call validar-local.cmd
exit /b %errorlevel%

:giterror
echo.
echo [ERRO] Nao foi possivel atualizar a homologacao local com seguranca.
echo Nenhum merge automatico foi realizado.
echo Envie um print desta tela para analise antes de continuar.
pause
exit /b 1
