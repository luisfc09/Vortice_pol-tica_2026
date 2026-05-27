# Vórtice Backend — TSE Integration

Servidor Express que serve dados eleitorais do TSE (Dados Abertos)
agregados por candidato × município. Fluxo em duas etapas:

1. **Importação (CLI, sob demanda):** `npm run import:tse` baixa o ZIP
   oficial do TSE, parseia o CSV (latin1, separador `;`), agrega os votos
   por (ano, turno, uf, município, cargo, candidato), e faz upsert na
   tabela `tse_resultados` do Supabase.
2. **Servidor (Express):** lê apenas do Supabase. Não chama o CKAN do
   TSE em request time — o CKAN é lento, instável, e os datasets atuais
   estão com `datastore_active: false` (só dão pra baixar ZIP).

A separação dá:

- Resposta rápida e consistente pro frontend (latência Supabase + cache)
- Cache em memória de 24h (dados históricos não mudam)
- CORS controlado (o TSE não habilita CORS pra browser)
- Reproducibilidade: o importer é idempotente (upsert pela unique key)

## Subir local

```sh
cd backend
cp .env.example .env   # preencha SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY
npm install
npm run dev
```

Servidor sobe em `http://localhost:3001`.

Health checks:

```sh
curl http://localhost:3001/api/health
curl http://localhost:3001/api/tse/health
```

## Importação de dados do TSE (CLI)

> Pré-requisito: a migration `supabase/migration-023-tse-resultados.sql`
> precisa estar aplicada no Supabase do projeto.

```sh
# Padrão recomendado pra começar (deputado estadual MG, 2022):
npm run import:tse -- --ano 2022 --uf MG --cargo 7

# Outros exemplos:
npm run import:tse -- --ano 2022 --uf MG --cargo 6   # Dep Federal
npm run import:tse -- --ano 2024 --uf MG --cargo 13  # Vereador
npm run import:tse -- --ano 2022 --uf MG --cargo 7 --turno 2

# Dry-run (não escreve nada — útil pra validar parsing):
npm run import:tse -- --ano 2022 --uf MG --cargo 7 --dry-run
```

Flags suportadas:

| Flag         | Default | Descrição                                          |
|--------------|---------|----------------------------------------------------|
| `--ano`      | (obrig) | Ano da eleição (`2018`, `2020`, `2022`, `2024`...) |
| `--uf`       | `MG`    | UF a importar                                      |
| `--cargo`    | (obrig) | Código do cargo (ver `/api/tse/cargos`)            |
| `--turno`    | `1`     | `1` ou `2`                                         |
| `--dry-run`  | false   | Faz tudo, mas não escreve no Supabase              |

O importer usa **service-role key** (bypassa RLS). Ela NÃO é usada pelo
servidor Express — só por esse script CLI.

## Endpoints

| Método | Path                                  | O que faz                                            |
|--------|---------------------------------------|------------------------------------------------------|
| GET    | `/api/health`                         | Status do backend                                    |
| GET    | `/api/tse/health`                     | Testa conexão com Supabase + total de registros      |
| GET    | `/api/tse/cargos`                     | Códigos de cargo suportados                          |
| GET    | `/api/tse/anos`                       | (ano, turno, uf) disponíveis na base                 |
| GET    | `/api/tse/resultados?ano=...&...`     | Votação filtrada (município, cargo, candidato, etc.) |
| GET    | `/api/tse/municipios/:nome?ano&cargo` | Ranking de candidatos num município                  |
| GET    | `/api/tse/candidatos?ano&uf&...`      | Candidatos agregados (total de votos no estado)      |
| GET    | `/api/tse/cache/stats`                | Estatísticas do cache em memória                     |
| POST   | `/api/tse/cache/flush`                | Limpa o cache (debug/dev)                            |

### Query params comuns

- `ano` — ex.: `2024`, `2022`, `2020`, `2018`. Default `2022`.
- `uf` — sigla, ex.: `MG`. Default `MG`.
- `turno` — `1` ou `2`. Default `1`.
- `municipio` — nome (busca parcial case-insensitive) **OU** código.
- `cargo` — código numérico: 1=Presidente, 3=Governador, 5=Senador,
  6=Dep Federal, **7=Dep Estadual**, 8=Dep Distrital, 11=Prefeito, 13=Vereador
- `candidato` — nome (parcial) ou número.
- `numero` — número do candidato (ex.: 4500).
- `partido` — sigla (ex.: `PSDB`).
- `limit`, `offset` — paginação (default 100/0; máx 1000).

### Exemplos

```sh
# Ranking de vereadores em BH em 2024:
curl "http://localhost:3001/api/tse/municipios/BELO%20HORIZONTE?ano=2024&cargo=13"

# Deputados estaduais por MG em 2022 (primeiros 100, ordenados por votos):
curl "http://localhost:3001/api/tse/resultados?ano=2022&uf=MG&cargo=7"

# Candidatos top do PSDB em 2022:
curl "http://localhost:3001/api/tse/candidatos?ano=2022&uf=MG&cargo=7&partido=PSDB"

# Buscar por nome:
curl "http://localhost:3001/api/tse/candidatos?ano=2022&uf=MG&nome=heleno"
```

## Variáveis de ambiente

| Var                         | Default | Quando trocar                                      |
|-----------------------------|---------|----------------------------------------------------|
| `PORT`                      | 3001    | Quando hospedar em uma porta diferente             |
| `FRONTEND_URL`              | —       | Em produção, defina pra liberar CORS               |
| `SUPABASE_URL`              | —       | URL do projeto Supabase                            |
| `SUPABASE_ANON_KEY`         | —       | Usada pelo servidor Express (RLS aplicada)         |
| `SUPABASE_SERVICE_ROLE_KEY` | —       | **SÓ no importer CLI**. Bypassa RLS.               |
| `CACHE_TTL_SECONDS`         | 86400   | Diminua só pra debug                               |

## Deploy

### Railway (recomendado, igual ao frontend)

1. Conecte o mesmo repo no Railway
2. Settings → Source → **Root Directory**: `backend`
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Variables:
   - `FRONTEND_URL=https://vorticepol-tica2026-production.up.railway.app`
   - `SUPABASE_URL=...`
   - `SUPABASE_ANON_KEY=...`
   - **NÃO** defina `SUPABASE_SERVICE_ROLE_KEY` no servidor de produção
     — ela só serve pro importer rodado localmente/no CI.

Railway expõe automaticamente uma URL pública tipo
`vortice-backend-production.up.railway.app`. Use essa URL no frontend
pra apontar pro backend.

### Importação no CI

Pra automatizar reimportação periódica, configure um job que rode:

```sh
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npm run import:tse -- --ano 2024 --uf MG --cargo 13
```

Como o upsert respeita a unique key `(ano, turno, uf, municipio_codigo,
cargo_codigo, sequencial_candidato)`, rodar 2x não duplica nada.

## Notas técnicas

### Por que não consultar o TSE direto?

- O CKAN do TSE retorna `Access-Control-Allow-Origin` inconsistente.
- Os datasets de resultados (2020/2022/2024) estão com
  `datastore_active: false` — `datastore_search` não funciona. Só dá
  pra baixar o ZIP e parsear.
- O ZIP de uma UF tem ~50–200MB, ~10M de linhas (granularidade
  zona/seção). Em request time é inviável. Por isso a importação é
  offline + agregação por candidato × município.

### Esquema da tabela

Granularidade: **1 linha por candidato × município** (votos somados
das zonas/seções). Veja `supabase/migration-023-tse-resultados.sql`.

Unicidade: `(ano, turno, uf, municipio_codigo, cargo_codigo,
sequencial_candidato)`. Reimportar substitui em vez de duplicar.

RLS: SELECT público (dados oficiais, sem confidencialidade). INSERT/
UPDATE/DELETE só via service-role.

### Limitações

- Primeira importação de uma UF grande (MG) leva alguns minutos
  (download + parse). Depois, leituras vêm do Postgres em < 100ms.
- Cache em memória é por instância — se rodar várias réplicas, cada
  uma tem seu cache. Pra invalidar, reinicie ou chame `/cache/flush`.
- Dados do TSE saem horas depois do fim da apuração.
