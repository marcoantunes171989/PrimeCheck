@echo off
setlocal EnableExtensions

set "LOCAL_PORT=%~1"
set "EXPECTED_SHA=%~2"
set "LOG_FILE=%~3"
set "PROJECT_DIR=%~dp0.."

if not defined LOCAL_PORT exit /b 2
if not defined EXPECTED_SHA exit /b 3
if not defined LOG_FILE set "LOG_FILE=%TEMP%\primecheck-vite-%LOCAL_PORT%.log"

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
  >"%LOG_FILE%" echo [ERRO] Nao foi possivel acessar o projeto: %PROJECT_DIR%
  exit /b 4
)

set "VITE_PRIMECHECK_SHA=%EXPECTED_SHA%"

>"%LOG_FILE%" echo PrimeCheck Vite local
>>"%LOG_FILE%" echo Porta: %LOCAL_PORT%
>>"%LOG_FILE%" echo SHA: %EXPECTED_SHA%
>>"%LOG_FILE%" echo Diretorio: %CD%
>>"%LOG_FILE%" echo.

call npm run serve:local -- --port %LOCAL_PORT% >>"%LOG_FILE%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

>>"%LOG_FILE%" echo.
>>"%LOG_FILE%" echo Vite finalizado com codigo %EXIT_CODE%.
exit /b %EXIT_CODE%
