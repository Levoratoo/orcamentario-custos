# Script para aguardar Docker e executar automaticamente
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Aguardando Docker Desktop..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$maxAttempts = 30
$attempt = 0
$dockerReady = $false

while ($attempt -lt $maxAttempts -and -not $dockerReady) {
    $attempt++
    Write-Host "Tentativa $attempt/$maxAttempts..." -ForegroundColor Gray
    
    try {
        $result = docker ps 2>&1
        if ($LASTEXITCODE -eq 0) {
            $dockerReady = $true
            Write-Host "`n✓ Docker está rodando!" -ForegroundColor Green
        } else {
            Write-Host "  Docker ainda não está pronto, aguardando 5 segundos..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
        }
    } catch {
        Write-Host "  Docker ainda não está pronto, aguardando 5 segundos..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
}

if ($dockerReady) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Iniciando aplicação na porta 3003" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "A aplicação estará disponível em:" -ForegroundColor Green
    Write-Host "  - API Backend: http://localhost:3003" -ForegroundColor White
    Write-Host "  - Swagger Docs: http://localhost:3003/docs" -ForegroundColor White
    Write-Host ""
    Write-Host "Pressione Ctrl+C para parar a aplicação" -ForegroundColor Yellow
    Write-Host ""
    
    docker compose up --build
} else {
    Write-Host ""
    Write-Host "✗ Timeout: Docker Desktop não iniciou após 2,5 minutos." -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor:" -ForegroundColor Yellow
    Write-Host "1. Verifique se o Docker Desktop está rodando" -ForegroundColor White
    Write-Host "2. Verifique o ícone na bandeja do sistema" -ForegroundColor White
    Write-Host "3. Execute manualmente: docker compose up --build" -ForegroundColor White
}
