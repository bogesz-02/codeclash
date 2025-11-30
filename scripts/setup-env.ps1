# Setup script for creating backend/.env from backend/.env.example
# Run this after cloning the repo to set up your local environment

$repoRoot = Split-Path -Parent $PSScriptRoot
$examplePath = Join-Path $repoRoot "backend\.env.example"
$destPath = Join-Path $repoRoot "backend\.env"

Write-Host "======================================"
Write-Host "  Environment Setup Script"
Write-Host "======================================"
Write-Host ""

# Check if example exists
if (-not (Test-Path $examplePath)) {
    Write-Error "Could not find $examplePath"
    exit 1
}

# Check if .env already exists
if (Test-Path $destPath) {
    $overwrite = Read-Host "backend.env already exists. Overwrite? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Keeping existing backend.env"
        notepad $destPath
        exit 0
    }
}

# Copy example to .env
Copy-Item $examplePath $destPath -Force
Write-Host "Created backend.env from example"

# Prompt for database password (plain text for simplicity)
Write-Host ""
Write-Host "Database Configuration:"
$plainPwd = Read-Host "Enter a secure database password (leave blank to keep example value)"

if ($plainPwd -and $plainPwd.Trim() -ne "") {
    # Replace DB and MySQL password fields in .env
    $content = Get-Content $destPath -Raw
    $content = $content -replace 'DB_PASS=.*', "DB_PASS=$plainPwd"
    $content = $content -replace 'MYSQL_ROOT_PASSWORD=.*', "MYSQL_ROOT_PASSWORD=$plainPwd"
    $content = $content -replace 'MYSQL_PASSWORD=.*', "MYSQL_PASSWORD=$plainPwd"
    # Ensure backend PORT is set to 3001 for consistency with docker-compose
    # Use a regex that only replaces the top-level PORT= (line start), not DB_PORT
    if ($content -match '(?m)^PORT=') {
        $content = $content -replace '(?m)^PORT=.*', 'PORT=3001'
    } else {
        $content = "PORT=3001`r`n" + $content
    }
    $content | Set-Content $destPath -Encoding UTF8
    Write-Host "Database password updated"
} else {
    Write-Host "Using default password from example (not secure for production)"
    # Also ensure PORT=3001 is present when keeping example values
    $content = Get-Content $destPath -Raw
    if ($content -match '(?m)^PORT=') {
        $content = $content -replace '(?m)^PORT=.*', 'PORT=3001'
    } else {
        $content = "PORT=3001`r`n" + $content
    }
    $content | Set-Content $destPath -Encoding UTF8
}

Write-Host ""
Write-Host "Setup complete!"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Review backend.env if needed (optional)"
Write-Host "  2. Start Docker: docker compose up --build"
Write-Host "  3. Access at http://localhost:5173 (frontend) and http://localhost:3001 (backend)"
Write-Host ""

# Open .env for review
$open = Read-Host "Open backend.env for review? (Y/n)"
if ($open -ne "n" -and $open -ne "N") {
    notepad $destPath
}
