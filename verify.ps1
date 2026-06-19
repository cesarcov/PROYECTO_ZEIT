# Compuerta de verificación — CeShark ERP Modular
# Regla de la constitución: nada es "terminado" sin que esto quede en VERDE.
#   1) el backend importa   2) smoke tests pasan   3) el frontend compila
# Uso:  .\verify.ps1

$root = $PSScriptRoot
Set-Location $root
$py = Join-Path $root "venv\Scripts\python.exe"

Write-Host "==> 1/3 Backend importa..." -ForegroundColor Cyan
& $py -c "import app.main"
if ($LASTEXITCODE -ne 0) { Write-Host "X El backend no importa" -ForegroundColor Red; exit 1 }

Write-Host "==> 2/3 Smoke tests (pytest)..." -ForegroundColor Cyan
& $py -m pytest "$root\tests\smoke" -q
if ($LASTEXITCODE -ne 0) { Write-Host "X Smoke tests en ROJO" -ForegroundColor Red; exit 1 }

Write-Host "==> 3/3 Build frontend (vite)..." -ForegroundColor Cyan
& npm --prefix "$root\frontend\myapp" run build
if ($LASTEXITCODE -ne 0) { Write-Host "X Build de frontend fallo" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "OK - TODO VERDE: seguro para continuar / hacer commit." -ForegroundColor Green
