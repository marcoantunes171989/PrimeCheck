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

echo [1/5] Buscando a ultima homologacao liberada...
git fetch origin homologacao-local-validacao
if errorlevel 1 goto :giterror

echo [2/5] Abrindo a branch de homologacao local...
git show-ref --verify --quiet refs/heads/homologacao-local-validacao
if errorlevel 1 (
  git switch -c homologacao-local-validacao --track origin/homologacao-local-validacao
) else (
  git switch homologacao-local-validacao
)
if errorlevel 1 goto :giterror

echo [3/5] Atualizando sem misturar branches...
git pull --ff-only origin homologacao-local-validacao
if errorlevel 1 goto :giterror

echo [4/5] Versao carregada:
git log -1 --oneline
echo.

echo [5/5] Iniciando validacao local...
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
