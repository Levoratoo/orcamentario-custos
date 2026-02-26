# Script para verificar Docker e executar o programa
Write-Host "Verificando se o Docker está instalado..." -ForegroundColor Cyan

# Verifica se o Docker está instalado
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker encontrado: $dockerVersion" -ForegroundColor Green
        
        # Verifica se o Docker está rodando
        Write-Host "`nVerificando se o Docker está rodando..." -ForegroundColor Cyan
        try {
            docker ps 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Docker está rodando!" -ForegroundColor Green
                
                Write-Host "`nIniciando o programa com Docker Compose..." -ForegroundColor Cyan
                Write-Host "Isso pode levar alguns minutos na primeira execução..." -ForegroundColor Yellow
                
                # Executa o docker-compose
                docker compose up --build
            } else {
                Write-Host "✗ Docker não está rodando!" -ForegroundColor Red
                Write-Host "Por favor, inicie o Docker Desktop e tente novamente." -ForegroundColor Yellow
            }
        } catch {
            Write-Host "✗ Erro ao verificar se o Docker está rodando: $_" -ForegroundColor Red
            Write-Host "Por favor, inicie o Docker Desktop e tente novamente." -ForegroundColor Yellow
        }
    } else {
        throw "Docker não encontrado"
    }
} catch {
    Write-Host "✗ Docker não está instalado!" -ForegroundColor Red
    Write-Host "`nPor favor, siga estes passos:" -ForegroundColor Yellow
    Write-Host "1. Baixe o Docker Desktop em: https://www.docker.com/products/docker-desktop/" -ForegroundColor White
    Write-Host "2. Execute o instalador e siga as instruções" -ForegroundColor White
    Write-Host "3. Reinicie o computador se necessário" -ForegroundColor White
    Write-Host "4. Inicie o Docker Desktop" -ForegroundColor White
    Write-Host "5. Execute este script novamente" -ForegroundColor White
    Write-Host "`nPressione qualquer tecla para abrir o site de download..." -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    Start-Process "https://www.docker.com/products/docker-desktop/"
}
