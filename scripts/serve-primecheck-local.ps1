param(
  [string]$ProjectDir = ""
)

$ErrorActionPreference = "Stop"
$Port = 4177

if ([string]::IsNullOrWhiteSpace($ProjectDir)) {
  $ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
  $ProjectDir = $ProjectDir.Trim().Trim('"').TrimEnd('\')
  $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir).Path
}

Set-Location $ProjectDir

$NodeCmd = (Get-Command node.exe -ErrorAction Stop).Source
$GitCmd = (Get-Command git.exe -ErrorAction Stop).Source
$sha = (& $GitCmd rev-parse HEAD).Trim()

if ($LASTEXITCODE -ne 0 -or $sha -notmatch '^[0-9a-fA-F]{40}$') {
  throw "Nao foi possivel identificar o SHA atual do PrimeCheck."
}

$viteJs = Join-Path $ProjectDir "node_modules\vite\bin\vite.js"
if (-not (Test-Path $viteJs)) {
  throw "Executavel do Vite nao encontrado: $viteJs"
}

$env:VITE_PRIMECHECK_SHA = $sha
$url = "http://127.0.0.1:$Port/?build=$sha"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  PRIME CHECK LOCAL - SERVIDOR DEFINITIVO" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "SHA: $sha"
Write-Host "URL: $url" -ForegroundColor Cyan
Write-Host ""
Write-Host "Mantenha esta janela aberta. Ctrl+C encerra o servidor." -ForegroundColor Yellow
Write-Host ""

$viteArgs = @(
  $viteJs,
  "--host",
  "127.0.0.1",
  "--port",
  "$Port",
  "--strictPort"
)

if ($env:PRIMECHECK_NO_OPEN -ne "1") {
  $viteArgs += @("--open", "/?build=$sha")
}

& $NodeCmd @viteArgs
$exitCode = $LASTEXITCODE

Write-Host ""
Write-Host "Servidor PrimeCheck encerrado. Codigo: $exitCode"

exit $exitCode
