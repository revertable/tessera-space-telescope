$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $projectRoot 'sveltekit'
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$env:MOSAIC_PROJECT_ROOT = $projectRoot
$env:npm_config_cache = Join-Path $projectRoot 'cache\npm'
$env:TEMP = Join-Path $projectRoot 'tmp'
$env:TMP = $env:TEMP
@($env:npm_config_cache, $env:TEMP) | ForEach-Object {
    New-Item -ItemType Directory -Force -Path $_ | Out-Null
}
if (-not (Test-Path -LiteralPath $npm)) { throw "npm.cmd was not found at $npm" }
Push-Location $appRoot
try { & $npm run dev -- --host 127.0.0.1 } finally { Pop-Location }
