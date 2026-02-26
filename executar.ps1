# Script para executar o programa na porta 3003
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Executando Plano Orçamentário Custos" -ForegroundColor Cyan
Write-Host "  Porta: 3003" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica se o Docker está instalado
Write-Host "Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker encontrado: $dockerVersion" -ForegroundColor Green
        
        # Verifica se o Docker está rodando
        Write-Host "`nVerificando se o Docker está rodando..." -ForegroundColor Yellow
        try {
            docker ps 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Docker está rodando!" -ForegroundColor Green
                
                Write-Host "`n========================================" -ForegroundColor Cyan
                Write-Host "Iniciando aplicação na porta 3003..." -ForegroundColor Cyan
                Write-Host "Isso pode levar alguns minutos na primeira execução..." -ForegroundColor Yellow
                Write-Host "========================================" -ForegroundColor Cyan
                Write-Host ""
                Write-Host "A aplicação estará disponível em:" -ForegroundColor Green
                Write-Host "  - API Backend: http://localhost:3003" -ForegroundColor White
                Write-Host "  - Swagger Docs: http://localhost:3003/docs" -ForegroundColor White
                Write-Host ""
                Write-Host "Pressione Ctrl+C para parar a aplicação" -ForegroundColor Yellow
                Write-Host ""
                
                # Executa o docker-compose
                docker compose up --build
            } else {
                Write-Host "✗ Docker não está rodando!" -ForegroundColor Red
                Write-Host ""
                Write-Host "Por favor:" -ForegroundColor Yellow
                Write-Host "1. Inicie o Docker Desktop" -ForegroundColor White
                Write-Host "2. Aguarde até o ícone ficar verde na bandeja do sistema" -ForegroundColor White
                Write-Host "3. Execute este script novamente" -ForegroundColor White
                Write-Host ""
                Write-Host "Deseja abrir o Docker Desktop agora? (S/N)" -ForegroundColor Cyan
                $resposta = Read-Host
                if ($resposta -eq "S" -or $resposta -eq "s") {
                    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
                    Write-Host "Aguardando Docker iniciar..." -ForegroundColor Yellow
                    Start-Sleep -Seconds 5
                }
            }
        } catch {
            Write-Host "✗ Erro ao verificar Docker: $_" -ForegroundColor Red
            Write-Host "Por favor, inicie o Docker Desktop manualmente." -ForegroundColor Yellow
        }
    } else {
        throw "Docker não encontrado"
    }
} catch {
    Write-Host "✗ Docker não está instalado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  INSTALAÇÃO NECESSÁRIA" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Para executar este programa, você precisa instalar o Docker Desktop." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Passos para instalação:" -ForegroundColor Cyan
    Write-Host "1. Baixe o Docker Desktop em:" -ForegroundColor White
    Write-Host "   https://www.docker.com/products/docker-desktop/" -ForegroundColor Green
    Write-Host "2. Execute o instalador" -ForegroundColor White
    Write-Host "3. Reinicie o computador quando solicitado" -ForegroundColor White
    Write-Host "4. Inicie o Docker Desktop" -ForegroundColor White
    Write-Host "5. Execute este script novamente" -ForegroundColor White
    Write-Host ""
    Write-Host "Deseja abrir o site de download agora? (S/N)" -ForegroundColor Cyan
    $resposta = Read-Host
    if ($resposta -eq "S" -or $resposta -eq "s") {
        Start-Process "https://www.docker.com/products/docker-desktop/"
    }
}
