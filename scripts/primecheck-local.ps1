param(
  [string]$ProjectDir = ""
)

$ErrorActionPreference = "Stop"
$Port = 4177

function Fail([string]$Message) {
  Write-Host ""
  Write-Host "[ERRO] $Message" -ForegroundColor Red
  throw $Message
}

function Run-Npm([string[]]$Arguments) {
  & $script:NpmCmd @Arguments
  if ($LASTEXITCODE -ne 0) {
    Fail "npm falhou: npm $($Arguments -join ' ')"
  }
}

if ([string]::IsNullOrWhiteSpace($ProjectDir)) {
  $ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
  $ProjectDir = $ProjectDir.Trim().Trim('"').TrimEnd('\')
  $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir).Path
}

Set-Location $ProjectDir

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  PrimeCheck - Homologacao Local" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$NodeCmd = (Get-Command node.exe -ErrorAction Stop).Source
$script:NpmCmd = (Get-Command npm.cmd -ErrorAction Stop).Source
$GitCmd = (Get-Command git.exe -ErrorAction Stop).Source

$sha = (& $GitCmd rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $sha -notmatch '^[0-9a-fA-F]{40}$') {
  Fail "Nao foi possivel identificar o SHA atual do PrimeCheck."
}
$shortSha = $sha.Substring(0, 12)
$url = "http://127.0.0.1:$Port/?build=$sha"

Write-Host "[1/7] Confirmando projeto PrimeCheck..."
$origin = (& $GitCmd remote get-url origin).Trim()
if ($origin -notmatch 'marcoantunes171989/PrimeCheck') {
  Fail "A pasta atual nao aponta para o repositorio oficial PrimeCheck. Origin: $origin"
}

$indexPath = Join-Path $ProjectDir "index.html"
$indexText = Get-Content $indexPath -Raw
if ($indexText -notmatch '<title>PrimeCheck \| Homologa') {
  Fail "O index.html local nao possui o titulo do PrimeCheck."
}
if ($indexText -match 'Pedido Prime') {
  Fail "Foi encontrada referencia a Pedido Prime no index.html do PrimeCheck."
}
Write-Host "[OK] Repositorio e titulo PrimeCheck confirmados." -ForegroundColor Green

Write-Host ""
Write-Host "[2/7] Liberando exclusivamente a porta $Port..."
try {
  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    if ($listener.OwningProcess -and $listener.OwningProcess -ne $PID) {
      Write-Host "Encerrando PID $($listener.OwningProcess) da porta $Port..."
      Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
} catch {
  Write-Host "Get-NetTCPConnection indisponivel; seguindo com verificacao HTTP."
}
Start-Sleep -Milliseconds 800

Write-Host ""
Write-Host "[3/7] Sincronizando dependencias..."
Run-Npm @("install", "--no-audit", "--no-fund")

Write-Host ""
Write-Host "[4/7] Limpando cache e validando build..."
$dist = Join-Path $ProjectDir "dist"
$viteCache = Join-Path $ProjectDir "node_modules\.vite"
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
if (Test-Path $viteCache) { Remove-Item $viteCache -Recurse -Force }

Run-Npm @("run", "build")
Run-Npm @("run", "verify:build-info")
Run-Npm @("run", "verify:nfce-menu-label")
Run-Npm @("run", "verify:nfce-short-cprod")
Run-Npm @("run", "verify:nfce-xml-format")

Write-Host ""
Write-Host "[5/7] Iniciando Vite diretamente pelo node.exe..."
$viteJs = Join-Path $ProjectDir "node_modules\vite\bin\vite.js"
if (-not (Test-Path $viteJs)) {
  Fail "Executavel do Vite nao encontrado: $viteJs"
}

$stdoutLog = Join-Path $env:TEMP "primecheck-vite-$Port-$shortSha-out.log"
$stderrLog = Join-Path $env:TEMP "primecheck-vite-$Port-$shortSha-err.log"
Remove-Item $stdoutLog, $stderrLog -Force -ErrorAction SilentlyContinue

$env:VITE_PRIMECHECK_SHA = $sha
$viteArgs = @('"' + $viteJs + '"', "--host", "127.0.0.1", "--port", "$Port", "--strictPort")
$viteProcess = Start-Process -FilePath $NodeCmd -ArgumentList $viteArgs -WorkingDirectory $ProjectDir -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru -WindowStyle Hidden

Write-Host "PID Vite: $($viteProcess.Id)"
Write-Host "SHA: $sha"
Write-Host "URL: $url"

try {
  Write-Host ""
  Write-Host "[6/7] Confirmando porta, HTTP e identidade do projeto..."
  $ready = $false

  for ($attempt = 1; $attempt -le 40; $attempt++) {
    if ($viteProcess.HasExited) {
      $out = if (Test-Path $stdoutLog) { Get-Content $stdoutLog -Raw } else { "" }
      $err = if (Test-Path $stderrLog) { Get-Content $stderrLog -Raw } else { "" }
      Write-Host ""
      Write-Host "===== VITE STDOUT ====="
      Write-Host $out
      Write-Host "===== VITE STDERR ====="
      Write-Host $err
      Fail "O processo Vite encerrou antes de disponibilizar a porta $Port."
    }

    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2 -Headers @{ "Cache-Control" = "no-cache" }
      if ($response.StatusCode -eq 200) {
        $html = [string]$response.Content
        if ($html -notmatch '<title>PrimeCheck \| Homologa') {
          Fail "A porta $Port respondeu, mas o HTML nao e do PrimeCheck."
        }
        if ($html -match 'Pedido Prime') {
          Fail "A porta $Port respondeu com conteudo do Pedido Prime."
        }

        $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $sidebar = (Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/src/components/Sidebar.tsx?ts=$stamp" -TimeoutSec 3).Content
        $analytics = (Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/src/pages/NfceAnalyticsPage.tsx?ts=$stamp" -TimeoutSec 3).Content

        if ($sidebar -notmatch 'Pesquisa por produtos') {
          Fail "A fonte servida nao contem o menu Pesquisa por produtos."
        }
        if ($analytics -notmatch 'Consulta de produtos') {
          Fail "A fonte servida nao contem a tela Consulta de produtos."
        }
        if ($analytics -notmatch 'over8') {
          Fail "A fonte servida nao contem o filtro de produtos maiores que 8 digitos."
        }

        $ready = $true
        break
      }
    } catch {
      if ($_.Exception.Message -match 'Pedido Prime|nao e do PrimeCheck|Pesquisa por produtos|Consulta de produtos|maiores que 8') {
        throw
      }
    }

    Start-Sleep -Milliseconds 500
  }

  if (-not $ready) {
    $out = if (Test-Path $stdoutLog) { Get-Content $stdoutLog -Raw } else { "" }
    $err = if (Test-Path $stderrLog) { Get-Content $stderrLog -Raw } else { "" }
    Write-Host ""
    Write-Host "===== VITE STDOUT ====="
    Write-Host $out
    Write-Host "===== VITE STDERR ====="
    Write-Host $err
    Fail "O PrimeCheck nao respondeu em $url."
  }

  Write-Host "[OK] Porta $Port responde HTTP 200 com PrimeCheck e codigo atualizado." -ForegroundColor Green

  Write-Host ""
  Write-Host "[7/7] Executando smoke real em navegador Chromium..."
  $browserCandidates = @(
    @{ Name = "Microsoft Edge"; Path = "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe" },
    @{ Name = "Microsoft Edge"; Path = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" },
    @{ Name = "Google Chrome"; Path = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" },
    @{ Name = "Google Chrome"; Path = "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe" }
  )

  $browser = $null
  $browserName = ""
  foreach ($candidate in $browserCandidates) {
    if ($candidate.Path -and (Test-Path $candidate.Path)) {
      $browser = $candidate.Path
      $browserName = $candidate.Name
      break
    }
  }

  if (-not $browser) {
    foreach ($commandName in @("msedge.exe", "chrome.exe")) {
      $command = Get-Command $commandName -ErrorAction SilentlyContinue
      if ($command) {
        $browser = $command.Source
        $browserName = if ($commandName -eq "msedge.exe") { "Microsoft Edge" } else { "Google Chrome" }
        break
      }
    }
  }

  if (-not $browser) {
    Fail "Nenhum navegador Chromium compativel foi encontrado para o smoke test."
  }

  Write-Host "Navegador de smoke: $browserName"

  $smokeDir = Join-Path $env:TEMP "primecheck-browser-$shortSha"
  $domFile = Join-Path $env:TEMP "primecheck-browser-$shortSha.html"
  $browserErr = Join-Path $env:TEMP "primecheck-browser-$shortSha.err"
  Remove-Item $smokeDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $domFile, $browserErr -Force -ErrorAction SilentlyContinue

  $browserArgs = @(
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--disable-extensions",
    "--user-data-dir=$smokeDir",
    "--virtual-time-budget=8000",
    "--dump-dom",
    $url
  )

  $browserProcess = Start-Process -FilePath $browser -ArgumentList $browserArgs -RedirectStandardOutput $domFile -RedirectStandardError $browserErr -Wait -PassThru

  if ($browserProcess.ExitCode -ne 0) {
    $browserErrorText = if (Test-Path $browserErr) { Get-Content $browserErr -Raw } else { "" }
    Write-Host $browserErrorText
    Fail "$browserName encerrou com codigo $($browserProcess.ExitCode)."
  }

  $dom = Get-Content $domFile -Raw
  if ($dom -notmatch 'PrimeCheck') { Fail "PrimeCheck nao apareceu no DOM renderizado." }
  if ($dom -match 'Pedido Prime') { Fail "Pedido Prime apareceu no DOM da homologacao PrimeCheck." }
  if ($dom -notmatch 'Processamento local') { Fail "Barra Processamento local nao foi montada." }
  if ($dom -notmatch [regex]::Escape($shortSha)) { Fail "SHA $shortSha nao apareceu no DOM." }
  if ($dom -match 'data-primecheck-runtime-error') { Fail "React acionou o Error Boundary." }

  Write-Host "[OK] $browserName confirmou PrimeCheck, React e SHA $shortSha." -ForegroundColor Green

  if ($viteProcess -and -not $viteProcess.HasExited) {
    Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue
  }

  for ($attempt = 1; $attempt -le 20; $attempt++) {
    $stillListening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $stillListening) { break }
    Start-Sleep -Milliseconds 250
  }

  if ($env:PRIMECHECK_CI -eq "1") {
    Write-Host "CI: launcher exato validado com sucesso."
    exit 0
  }

  Write-Host ""
  Write-Host "==================================================" -ForegroundColor Green
  Write-Host "  PRIME CHECK LOCAL PRONTO" -ForegroundColor Green
  Write-Host "==================================================" -ForegroundColor Green
  Write-Host ""
  Write-Host "O servidor definitivo sera iniciado agora na porta 4177." -ForegroundColor Cyan
  Write-Host ""

  $serverScript = Join-Path $PSScriptRoot "serve-primecheck-local.ps1"
  if (-not (Test-Path $serverScript)) {
    Fail "Script do servidor definitivo nao encontrado: $serverScript"
  }

  & $serverScript
  $serverExit = $LASTEXITCODE

  if ($serverExit -ne 0) {
    Fail "O servidor definitivo encerrou com codigo $serverExit."
  }

}
finally {
  if ($viteProcess -and -not $viteProcess.HasExited) {
    Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
