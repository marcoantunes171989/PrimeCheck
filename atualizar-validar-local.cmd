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

echo [1/7] Buscando a ultima homologacao liberada...
git fetch origin homologacao-local-validacao
if errorlevel 1 goto :giterror

echo [2/7] Abrindo a branch de homologacao local...
git show-ref --verify --quiet refs/heads/homologacao-local-validacao
if errorlevel 1 (
  git switch -c homologacao-local-validacao --track origin/homologacao-local-validacao
) else (
  git switch homologacao-local-validacao
)
if errorlevel 1 goto :giterror

echo [3/7] Atualizando sem misturar branches...
git pull --ff-only origin homologacao-local-validacao
if errorlevel 1 goto :giterror

echo [4/7] Versao carregada:
git log -1 --oneline
echo.

echo [5/7] Confirmando SHA local = remoto...
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

echo [6/7] Confirmando menu NFC-e "Consulta produto"...
findstr /C:"label: 'Consulta produto'" "src\components\Sidebar.tsx" >nul
if errorlevel 1 (
  echo [ERRO] A branch carregada nao contem o menu "Consulta produto".
  echo Atualizacao interrompida para evitar validar uma versao incorreta.
  pause
  exit /b 1
)
echo [OK] Menu "Consulta produto" confirmado no codigo-fonte.
echo.

echo [7/7] Iniciando validacao local...
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
