# Printbag Backend (Planejamento Orcamentario por Coordenador)

Backend NestJS + Prisma + PostgreSQL para planejamento orcamentario por coordenador.

## Requisitos
- Docker + Docker Compose

## Como subir

```bash
cp .env.example .env
# ajuste variaveis se desejar

docker compose up --build
```

A API inicia em `http://localhost:3000` e a documentacao Swagger em `http://localhost:3000/docs`.

### Seed inicial

```bash
# dentro do container app (ou localmente com DATABASE_URL configurado)
node_modules/.bin/prisma db seed
```

Usuarios seed:
- `admin@printbag.local` / `ChangeMe123!`
- `controller@printbag.local` / `ChangeMe123!`
- `coordinator@printbag.local` / `ChangeMe123!`

## Endpoints principais

Auth:
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Users:
- `GET /me`
- `GET /users` (ADMIN)
- `POST /users` (ADMIN)
- `PUT /users/:id` (ADMIN)

CostCenters:
- `GET /cost-centers`
- `POST /cost-centers` (ADMIN/CONTROLLER)
- `PUT /cost-centers/:id` (ADMIN/CONTROLLER)
- `PUT /cost-centers/:id/owner` (ADMIN/CONTROLLER)

Accounts:
- `GET /accounts`
- `POST /accounts` (ADMIN/CONTROLLER)
- `PUT /accounts/:id` (ADMIN/CONTROLLER)

Scenarios:
- `GET /scenarios`
- `GET /scenarios/:id`
- `POST /scenarios` (ADMIN/CONTROLLER)
- `PUT /scenarios/:id` (ADMIN/CONTROLLER)
- `POST /scenarios/:id/submit` (ADMIN/CONTROLLER)
- `POST /scenarios/:id/reopen` (ADMIN/CONTROLLER)
- `POST /scenarios/:id/approve` (ADMIN/CONTROLLER)
- `POST /scenarios/:id/lock` (ADMIN/CONTROLLER)

BudgetLines:
- `GET /budget-lines`
- `POST /budget-lines`
- `PUT /budget-lines/:id`
- `DELETE /budget-lines/:id`
- `POST /budget-lines/bulk-upsert`
- `GET /budget-lines/summary?scenarioId=...&groupBy=costCenter|account|category`

Imports:
- `POST /imports/budget-lines` (multipart file=csv or JSON contentBase64)

## Exemplos

### 1) Login
```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@printbag.local","password":"ChangeMe123!"}'
```

### 2) Criar scenario
```bash
curl -s -X POST http://localhost:3000/scenarios \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Orcamento 2026","year":2026}'
```

### 3) Criar Centro de Custo
```bash
curl -s -X POST http://localhost:3000/cost-centers \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"code":"CC-LOG","name":"Logistica"}'
```

### 4) Criar Conta
```bash
curl -s -X POST http://localhost:3000/accounts \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"code":"13.03","name":"Plano de saude","category":"Beneficios"}'
```

### 5) Lancar BudgetLine
```bash
curl -s -X POST http://localhost:3000/budget-lines \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "scenarioId":"<SCENARIO_ID>",
    "costCenterId":"<COST_CENTER_ID>",
    "accountId":"<ACCOUNT_ID>",
    "description":"Plano de saude colaboradores",
    "driverType":"FIXED",
    "driverValue":null,
    "assumptions":"Contrato anual, reajuste em Jul 6%",
    "monthlyValues":{
      "01":"1200.00","02":"1200.00","03":"1200.00","04":"1200.00",
      "05":"1200.00","06":"1200.00","07":"1272.00","08":"1272.00",
      "09":"1272.00","10":"1272.00","11":"1272.00","12":"1300.00"
    }
  }'
```

### 6) Summary
```bash
curl -s -X GET "http://localhost:3000/budget-lines/summary?scenarioId=<SCENARIO_ID>&groupBy=costCenter" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Testes

```bash
npm test
```

> Necessita banco acessivel em `DATABASE_URL`.
