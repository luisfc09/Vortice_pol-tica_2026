# Vórtice Backend — TSE Integration

Servidor Express que proxia e cacheia a API de Dados Abertos do TSE
(`dadosabertos.tse.jus.br/api/3/action`). Frontend chama esse backend
em vez do TSE direto pra ter:

- CORS controlado (TSE não habilita CORS pro browser na maioria dos endpoints)
- Cache em memória (24h por padrão) — dados históricos não mudam
- Normalização de campos (`NM_MUNICIPIO` vira `municipio`, etc.)
- Agregações úteis (votos por candidato em um município)

## Subir local

```sh
cd backend
cp .env.example .env
npm install
npm run dev
```

Servidor sobe em `http://localhost:3001`.

Health check:
```sh
curl http://localhost:3001/api/health
curl http://localhost:3001/api/tse/health
```

## Endpoints

| Método | Path                                | O que faz                                         |
|--------|-------------------------------------|---------------------------------------------------|
| GET    | `/api/health`                       | Status do backend (sem tocar TSE)                 |
| GET    | `/api/tse/health`                   | Testa conexão com CKAN do TSE                     |
| GET    | `/api/tse/cargos`                   | Lista dos códigos de cargo suportados             |
| GET    | `/api/tse/resultados?ano=...&...`   | Votação por município/cargo/candidato             |
| GET    | `/api/tse/municipios/:nome?ano&cargo` | Resultado agregado de um município (ranking)    |
| GET    | `/api/tse/candidatos?ano&uf&...`    | Lista de candidatos registrados                   |
| GET    | `/api/tse/cache/stats`              | Estatísticas do cache em memória                  |
| POST   | `/api/tse/cache/flush`              | Limpa o cache (debug/dev)                         |

### Query params comuns

- `ano` — ex.: `2026`, `2022`, `2020`, `2018`. Default `2022`.
- `uf` — sigla, ex.: `MG`. Default `MG`.
- `municipio` — nome (case-insensitive, transformado em upper)
- `cargo` — código numérico: 1=Presidente, 3=Governador, 5=Senador,
  6=Dep Federal, **7=Dep Estadual**, 8=Dep Distrital, 11=Prefeito, 13=Vereador
- `candidato` — nome (parcial OK)
- `numero` — número do candidato (ex.: 4500)
- `limit`, `offset` — paginação (default 100/0)

### Exemplos

```sh
# Vereadores eleitos em BH em 2024 (top resultados):
curl "http://localhost:3001/api/tse/municipios/BELO%20HORIZONTE?ano=2024&cargo=13"

# Deputados estaduais por MG em 2022 (primeiros 100):
curl "http://localhost:3001/api/tse/resultados?ano=2022&uf=MG&cargo=7"

# Candidato específico em 2022:
curl "http://localhost:3001/api/tse/candidatos?ano=2022&uf=MG&cargo=7&numero=4500"
```

## Variáveis de ambiente

| Var               | Default | Quando trocar                                |
|-------------------|---------|----------------------------------------------|
| `PORT`            | 3001    | Quando hospedar em uma porta diferente       |
| `FRONTEND_URL`    | —       | Em produção, defina pra liberar CORS         |
| `CACHE_TTL_SECONDS` | 86400 | Diminua só pra debug; pra dados históricos, mantenha alto |

## Deploy

### Railway (recomendado, igual ao frontend)

1. Conecte o mesmo repo no Railway
2. Settings → Source → **Root Directory**: `backend`
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Variables: `FRONTEND_URL=https://vorticepol-tica2026-production.up.railway.app`

Railway expõe automaticamente uma URL pública tipo
`vortice-backend-production.up.railway.app`. Use essa URL no frontend
pra apontar pro backend.

### Fly.io / Render / qualquer Node host

Mesma receita: `npm run build && npm start`, expor a porta `PORT`.

## Notas técnicas

### Por que não chamar o TSE direto do frontend?

- O CKAN do TSE não retorna `Access-Control-Allow-Origin` em todos os
  endpoints — o browser bloqueia.
- Sem cache server-side, cada usuário gera tráfego pesado contra o TSE
  (o `datastore_search` é lento). 1 chamada cacheada serve 1000 usuários.
- O backend normaliza campos (`NM_MUNICIPIO` → `municipio`, etc.) e
  agrega votos antes de devolver — JSON menor e mais útil.

### Datasets do TSE — descoberta dinâmica

A função `tseClient.getResourceIds(datasetId)` chama `/package_show`
e mapeia `{ resource_name: resource_id }`. Isso é importante porque os
ids dos recursos mudam quando o TSE republica datasets — não dá pra
hardcoded. A heurística `pickResultadosResource` escolhe o recurso de
"votação por município" preferencialmente.

### Limitações

- Anos com muitos resultados (presidencial) podem demorar o primeiro
  request — após cached, instantâneo.
- O CKAN tem rate limit (não documentado oficialmente). Cache reduz isso.
- A TSE não tem dados em tempo real — esses dados ficam disponíveis
  algumas horas após o fim da apuração de cada eleição.
