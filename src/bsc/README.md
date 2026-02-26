# BSC Module (Mapa Estratégico 2025)

## Importação

- Endpoint: `POST /bsc/import`
- Form-data: `file` (`.xlsx`)
- Requer role: `ADMIN` ou `CONTROLLER`
- Idempotência:
  - hash SHA-256 do arquivo em `BscImport.fileHash`
  - se o hash já foi importado com sucesso, retorna `reused: true`
  - dados estratégicos/projetos usam `upsert` por chaves naturais

## Endpoints

- `GET /bsc/imports`
- `GET /bsc/imports/:id`
- `GET /bsc/map`
- `GET /bsc/indicators`
- `GET /bsc/indicators/:code`
- `GET /bsc/management?year=2025`
- `GET /bsc/management/summary?year=2025`
- `GET /bsc/projects?snapshot=2025-04-08`
- `GET /bsc/projects/snapshots`
- `GET /bsc/projects/:projectId/tasks`
- `GET /bsc/tasks/:taskId/snapshots`

## Frontend

- `/bsc/map`
- `/bsc/management`
- `/bsc/indicator/[code]`
- `/bsc/execution`

