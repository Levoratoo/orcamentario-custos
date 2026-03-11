# Orcamentario Custos - Portfolio Demo (Mock Local)

Esta branch esta preparada para publicacao estatica de portfolio, sem dependencia de backend, banco ou rotas server-side.

## O que mudou

- chamadas `fetch`/`/api/*` foram substituidas por provider local mock em `frontend/src/lib/portfolio-demo.ts`
- autenticacao usa sessao local (localStorage) via `portfolioDemoAuth`
- contratos de dados foram mantidos para nao quebrar filtros, ordenacao, paginacao, graficos e estados de loading/erro
- frontend Next.js configurado para export estatico (`output: "export"`)
- rotas server-only removidas (`frontend/src/app/api/**` e `frontend/src/middleware.ts`)
- workflow de deploy para GitHub Pages publica `frontend/out`

## Credenciais demo

Usuarios disponiveis (campo `Usuario` na tela de login):

- `admin`
- `controller`
- `ana.costa`
- `joao.lima`

Senha: qualquer valor com 3+ caracteres.

## Rodar localmente (modo portfolio)

```bash
npm ci --prefix frontend
npm run dev --prefix frontend
```

Abrir: `http://localhost:3004`

## Build estatico local

```bash
npm ci --prefix frontend
npm run build --prefix frontend
```

Saida estara em `frontend/out`.

## Publicacao automatica no GitHub Pages

Workflow: `.github/workflows/deploy-frontend-pages.yml`

Gatilhos:

- push na branch `main`
- execucao manual (`workflow_dispatch`)

Processo:

1. instala dependencias do frontend
2. executa `next build` com export estatico
3. publica `frontend/out` no GitHub Pages

## URL esperada no Pages

Com repositório `Levoratoo/orcamentario-custos`, a URL final do Pages e:

`https://levoratoo.github.io/orcamentario-custos/`
