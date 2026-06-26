# Force UTF-8 so block/box characters render correctly
$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'
$root = $PSScriptRoot

$host.UI.RawUI.WindowTitle = "GexLab v2"
Clear-Host

Write-Host ""
Write-Host "   ██████╗ ███████╗██╗  ██╗██╗      █████╗ ██████╗  " -ForegroundColor DarkYellow
Write-Host "  ██╔════╝ ██╔════╝╚██╗██╔╝██║     ██╔══██╗██╔══██╗ " -ForegroundColor DarkYellow
Write-Host "  ██║  ███╗█████╗   ╚███╔╝ ██║     ███████║██████╔╝  " -ForegroundColor DarkYellow
Write-Host "  ██║   ██║██╔══╝   ██╔██╗ ██║     ██╔══██║██╔══██╗ " -ForegroundColor DarkYellow
Write-Host "  ╚██████╔╝███████╗██╔╝ ██╗███████╗██║  ██║██████╔╝  " -ForegroundColor DarkYellow
Write-Host "   ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝  " -ForegroundColor DarkYellow
Write-Host ""
Write-Host "       Gamma Exposure Intelligence  ·  v2" -ForegroundColor Yellow
Write-Host ""
Write-Host "  ────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ── Kill stale processes on 8000 / 3000 ──────────────────────────────────────
foreach ($port in 8000, 3000) {
    $lines = netstat -ano | Where-Object { $_ -match ":$port\s" }
    foreach ($line in $lines) {
        $p = ($line -split '\s+')[-1]
        if ($p -match '^\d+$') { taskkill /F /PID $p 2>$null | Out-Null }
    }
}

# ── Start backend in a minimised window ──────────────────────────────────────
Write-Host "  [1/2]  Starting backend engine..." -ForegroundColor Gray
$backend = Start-Process -FilePath "cmd" `
    -ArgumentList "/c venv\Scripts\python -m uvicorn main:app" `
    -WorkingDirectory "$root\backend" `
    -PassThru -WindowStyle Minimized

Start-Sleep -Seconds 4

# ── Open browser automatically once the dev server is ready ──────────────────
# Runs in a background job so it doesn't block the frontend startup.
$null = Start-Job -ScriptBlock {
    param($url)
    # Poll until Next.js responds, then open
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        try {
            $r = Invoke-WebRequest -Uri $url -TimeoutSec 1 -UseBasicParsing
            if ($r.StatusCode -eq 200) { break }
        } catch {}
    }
    Start-Process $url
} -ArgumentList "http://localhost:3000"

# ── Run frontend inline (blocking) ───────────────────────────────────────────
Write-Host "  [2/2]  Starting dashboard (close this window to stop)..." -ForegroundColor Gray
Write-Host ""

Push-Location "$root\frontend"
try {
    npm run dev
} finally {
    # ── Cleanup: fires on Ctrl+C or window close ──────────────────────────────
    Write-Host ""
    Write-Host "  Shutting down all services..." -ForegroundColor Yellow

    # Kill backend process tree
    if ($backend -and $backend.Id) {
        taskkill /T /F /PID $backend.Id 2>$null | Out-Null
    }

    # Belt-and-suspenders: clear both ports
    foreach ($port in 8000, 3000) {
        $lines = netstat -ano | Where-Object { $_ -match ":$port\s" }
        foreach ($line in $lines) {
            $p = ($line -split '\s+')[-1]
            if ($p -match '^\d+$') { taskkill /F /PID $p 2>$null | Out-Null }
        }
    }

    # Remove the background browser-opener job
    Get-Job | Remove-Job -Force

    Pop-Location
    Write-Host "  All services stopped." -ForegroundColor DarkGray
    Write-Host ""
    Start-Sleep -Seconds 2
}
