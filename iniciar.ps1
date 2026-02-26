# Script simples para iniciar o projeto na porta 3003
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Iniciando Plano Orçamentário Custos" -ForegroundColor Cyan
Write-Host "  Porta: 3003" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica Docker
Write-Host "Verificando Docker..." -ForegroundColor Yellow
$dockerCheck = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Docker não está rodando!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor:" -ForegroundColor Yellow
    Write-Host "1. Abra o Docker Desktop" -ForegroundColor White
    Write-Host "2. Aguarde o ícone ficar verde na bandeja do sistema" -ForegroundColor White
    Write-Host "3. Execute este script novamente" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "✓ Docker está rodando!" -ForegroundColor Green
Write-Host ""
Write-Host "Iniciando aplicação..." -ForegroundColor Cyan
Write-Host ""
Write-Host "A aplicação estará disponível em:" -ForegroundColor Green
Write-Host "  - API Backend: http://localhost:3003" -ForegroundColor White
Write-Host "  - Swagger Docs: http://localhost:3003/docs" -ForegroundColor White
Write-Host ""
Write-Host "Pressione Ctrl+C para parar" -ForegroundColor Yellow
Write-Host ""

docker compose up --build
