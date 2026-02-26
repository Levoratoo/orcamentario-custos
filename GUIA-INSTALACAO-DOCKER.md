# Guia de Instalação do Docker e Execução do Programa

## 📋 Pré-requisitos

- Windows 10/11 (64-bit)
- WSL 2 habilitado (o instalador do Docker pode fazer isso automaticamente)

## 🐳 Passo 1: Instalar o Docker Desktop

1. **Baixe o Docker Desktop para Windows:**
   - Acesse: https://www.docker.com/products/docker-desktop/
   - Clique em "Download for Windows"
   - O arquivo baixado será algo como `Docker Desktop Installer.exe`

2. **Execute o instalador:**
   - Clique duas vezes no arquivo baixado
   - Marque a opção "Use WSL 2 instead of Hyper-V" (recomendado)
   - Siga as instruções do instalador
   - **IMPORTANTE:** Reinicie o computador quando solicitado

3. **Inicie o Docker Desktop:**
   - Após reiniciar, procure por "Docker Desktop" no menu Iniciar
   - Execute o Docker Desktop
   - Aguarde até que o ícone do Docker na bandeja do sistema fique verde (indicando que está rodando)
   - Na primeira execução, pode levar alguns minutos para inicializar

## 🚀 Passo 2: Executar o Programa

Após o Docker estar instalado e rodando, execute um dos comandos abaixo no PowerShell ou Prompt de Comando:

### Opção 1: Usando o script automatizado
```powershell
powershell -ExecutionPolicy Bypass -File .\executar-docker.ps1
```

### Opção 2: Comando direto
```powershell
docker compose up --build
```

## 📝 O que acontece quando você executa:

1. O Docker irá:
   - Baixar a imagem do PostgreSQL (banco de dados)
   - Construir a imagem da aplicação backend
   - Criar e iniciar os containers

2. A aplicação estará disponível em:
   - **API Backend:** http://localhost:3000
   - **Documentação Swagger:** http://localhost:3000/docs
   - **Banco de dados PostgreSQL:** localhost:5432

3. **Credenciais do banco de dados:**
   - Usuário: `printbag`
   - Senha: `printbag`
   - Database: `printbag`

## 🔧 Comandos úteis do Docker

- **Parar os containers:** `docker compose down`
- **Ver logs:** `docker compose logs`
- **Ver containers rodando:** `docker ps`
- **Reconstruir tudo:** `docker compose up --build`

## ⚠️ Solução de Problemas

### Docker não inicia
- Verifique se o WSL 2 está instalado e atualizado
- Execute o Docker Desktop como Administrador
- Verifique se a virtualização está habilitada no BIOS

### Erro de porta já em uso
- Se a porta 3000 ou 5432 já estiver em uso, pare outros serviços ou altere as portas no `docker-compose.yml`

### Erro ao construir a imagem
- Certifique-se de ter espaço em disco suficiente (pelo menos 10GB livres)
- Verifique sua conexão com a internet (o Docker precisa baixar imagens)

## 📚 Próximos Passos

Após a aplicação estar rodando, você pode:

1. **Popular o banco com dados iniciais:**
   ```powershell
   docker compose exec app node_modules/.bin/prisma db seed
   ```

2. **Fazer login na API:**
   - Email: `admin@printbag.local`
   - Senha: `ChangeMe123!`

3. **Acessar a documentação:** http://localhost:3000/docs

---

**Precisa de ajuda?** Consulte o README.md para mais informações sobre a API e seus endpoints.
