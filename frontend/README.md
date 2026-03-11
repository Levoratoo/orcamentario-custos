# Frontend - Portfolio Demo

Next.js (App Router) configurado para export estatico com dados mock locais.

## Execucao local

```bash
npm install
npm run dev
```

Aplicacao: `http://localhost:3004`

## Build estatico

```bash
npm run build
```

Arquivos gerados em `out/`.

## Dados mock

Provider local: `src/lib/portfolio-demo.ts`

- mock de auth (`portfolioDemoAuth`)
- mock de API (`portfolioDemoRequest`)
- contratos alinhados com `src/services/backend.ts`

## Publicacao Pages

No GitHub Actions, `next.config.ts` aplica automaticamente:

- `output: "export"`
- `basePath` pelo nome do repositorio
- `assetPrefix` compativel com subpath
