# Printbag Frontend

Next.js 14 (App Router) com Tailwind + shadcn/ui, consumindo API Printbag.

## Requisitos
- Node.js 18+

## Como rodar

```bash
npm install
npm run dev
```

Acesse `http://localhost:3003` (ou a porta exibida pelo Next).

## Build

```bash
npm run build
npm start
```

## Variaveis de ambiente

Crie `.env.local` baseado em `.env.example`.

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:3000
```

## Estrutura
- `src/app` rotas e layouts
- `src/components` UI, layouts e providers
- `src/features` componentes por dominio
- `src/services` chamadas API
- `src/hooks` hooks customizados
- `src/lib` tipos e helpers

## Autenticacao
- /api/auth/login: proxy para backend, grava refreshToken em cookie httpOnly
- /api/auth/refresh: renova accessToken usando refreshToken cookie
- /api/auth/logout: invalida refreshToken
- /api/backend/*: proxy para chamadas do frontend
