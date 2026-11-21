# Smart Airport System - Windows Direct Service Launcher
$ErrorActionPreference = "Continue"
$root = if ($PSScriptRoot) { $PSScriptRoot } else { "c:\Users\cooly\OneDrive\Desktop\Smart_Airport_System" }
$python = "C:\Users\cooly\AppData\Local\Python\bin\python.exe"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " Starting Smart Airport System (BE, FE, AI, Postgres) " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 0. Check / Start PostgreSQL
$pgPort = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
if (-not $pgPort) {
    Write-Host "[0/5] Ensuring PostgreSQL 18 is running on port 5432..." -ForegroundColor Yellow
    $pidFile = "C:\Program Files\PostgreSQL\18\data\postmaster.pid"
    if (Test-Path $pidFile) {
        $stalePid = (Get-Content $pidFile -First 1).Trim()
        $proc = Get-Process -Id $stalePid -ErrorAction SilentlyContinue
        if (-not $proc) {
            Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
        }
    }
    & "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" start -D "C:\Program Files\PostgreSQL\18\data"
    Start-Sleep -Seconds 2
} else {
    Write-Host "[0/5] PostgreSQL 18 is already online on port 5432." -ForegroundColor Green
}

# 1. Start Backend (port 8000)
Write-Host "[1/5] Launching FastAPI Backend on http://localhost:8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; & '$python' -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

# 2. Start AI Face Recognition (port 8001)
Write-Host "[2/5] Launching AI Face Reco on http://localhost:8001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\AI\face_reco'; `$env:DEEPFACE_HOME='$root\AI\face_reco'; & '$python' -m uvicorn app.main:app --host 0.0.0.0 --port 8001"

# 3. Start AI Baggage Threat Detection (port 8002)
Write-Host "[3/5] Launching AI Baggage Threat Detection (BTD) on http://localhost:8002..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\AI\BTD'; & '$python' -m uvicorn inference_server:app --host 0.0.0.0 --port 8002"

# 4. Start AI Unified Detection (port 8004)
Write-Host "[4/5] Launching AI Unified Detection on http://localhost:8004..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\AI\unified_detection'; & '$python' -m uvicorn inference_server:app --host 0.0.0.0 --port 8004"

# 5. Start Frontend (port 5173)
Write-Host "[5/5] Launching Frontend on http://localhost:5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npx vite --host 0.0.0.0 --port 5173"

Write-Host "======================================================" -ForegroundColor Green
Write-Host " Services launched in dedicated console windows:      " -ForegroundColor Green
Write-Host " - Frontend:           http://localhost:5173          " -ForegroundColor Green
Write-Host " - Backend API:        http://localhost:8000          " -ForegroundColor Green
Write-Host "   (API Docs):         http://localhost:8000/docs     " -ForegroundColor Green
Write-Host " - AI Face Reco:       http://localhost:8001          " -ForegroundColor Green
Write-Host " - AI Baggage Threat:  http://localhost:8002          " -ForegroundColor Green
Write-Host " - AI Unified Detect:  http://localhost:8004          " -ForegroundColor Green
Write-Host " - PostgreSQL:         localhost:5432 (smart_airport) " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
