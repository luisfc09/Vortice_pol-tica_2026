# Vórtice

Plataforma de gestão de campanha política — Eleições 2026.

Stack: React + TypeScript + Vite + Tailwind + Shadcn/ui + Supabase (auth/banco/realtime/RLS). Deploy via Railway.

## Setup local

```bash
npm install
cp .env.example .env
# edite .env conforme a seção "Configurar Supabase" abaixo
npm run dev
```

Acesse `http://localhost:5173`.

### Modo demonstração (sem Supabase)

`VITE_USE_MOCKS=true` no `.env`. Dados ficam em `localStorage`. Use:

- **Admin** — `admin@vortice.app` / `vortice2026`
- **Agente de campo** — `campo@vortice.app` / `vortice2026`

Botões no login preenchem os campos automaticamente.

---

## Configurar Supabase

### 1. Provisionar o banco

1. Crie um projeto novo no [Supabase](https://supabase.com).
2. **SQL Editor** → cole e execute `supabase/schema.sql` (cria 11 tabelas + RLS + trigger + realtime).
3. Opcional: `supabase/seed-faq.sql` para popular o FAQ global mínimo.

### 2. Criar o primeiro usuário admin

1. **Authentication > Settings** → desligue "Enable signups" (acesso só por convite).
2. **Authentication > Users > Add user** → crie o admin com e-mail e senha.
3. **SQL Editor** → abra `supabase/bootstrap.sql` e siga os 4 passos comentados (criar campanha, listar users, inserir em campaign_users, ajustar profile).

### 3. Configurar variáveis

Em **Settings > API** copie a URL e a anon key, e edite o `.env`:

```bash
VITE_USE_MOCKS=false
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
```

### 4. Migration de provisionamento

No SQL Editor, rode `supabase/migration-002-provisioning.sql` — adiciona `campaign_users.is_active` e `profiles.must_change_password`.

### 5. Edge function `provision-user`

Admin provisiona membros diretamente (sem fluxo de "aceitar convite"):

```bash
# CLI do Supabase
supabase login
supabase link --project-ref iemajqwnlkmrubikhqas
supabase functions deploy provision-user

# Opcional: URL de login retornada nas credenciais
supabase secrets set APP_LOGIN_URL=https://seu-dominio/login
```

### 6. Login com Google (opcional mas recomendado)

**6.1 Google Cloud Console** ([console](https://console.cloud.google.com/apis/credentials)):

1. **Create credentials → OAuth client ID**
2. Application type: **Web application**
3. **Authorized JavaScript origins**:
   - `http://localhost:5173`
   - URL de produção (quando tiver)
4. **Authorized redirect URIs**:
   - `https://iemajqwnlkmrubikhqas.supabase.co/auth/v1/callback`
5. Salva → copia **Client ID** e **Client Secret**

**6.2 Supabase**:

- [Authentication → Sign In/Up → Providers → Google](https://supabase.com/dashboard/project/iemajqwnlkmrubikhqas/auth/providers)
- Toggle **Enable**
- Cola Client ID e Secret
- Salva

Pronto. O botão "Continuar com Google" aparece no /login quando `VITE_USE_MOCKS=false`.

> ⚠️ O Google só entra para usuários **já provisionados** pelo admin com o **mesmo e-mail** da conta Google. Quem tenta login sem ter sido provisionado é deslogado automaticamente.

---

## Deploy (Railway)

Conecte o repositório no Railway. O `railway.toml` configura build (`npm ci && npm run build`) e start (`npm run start`).

No projeto Railway, adicione as env vars:

- `VITE_USE_MOCKS=false`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## Arquitetura

| Caminho | Conteúdo |
| --- | --- |
| `src/components/ui` | Shadcn (Button, Input, Card, Sheet, Select, Slider, Checkbox, Accordion, Tabs, Avatar, Badge, Separator, Sonner) |
| `src/components/layout` | AppLayout, Sidebar, Header, ProtectedRoute, PlaceholderPage |
| `src/components/data` | EmptyState, SearchBar, FilterPill, ConfirmDelete |
| `src/components/auth` | LoginForm |
| `src/components/field` | InterviewForm, FaqCard, OfflineBanner |
| `src/components/supporters` | SupporterFormSheet |
| `src/components/voters` | VoterFormSheet |
| `src/components/events` | EventFormSheet |
| `src/components/team` | InviteSheet |
| `src/components/dashboard` | KpiCard, RegistrationChart, AlertsList, ActivityFeed, UpcomingEvents |
| `src/components/mapa` | StateMap, MunicipalityDrawer, MapLegend |
| `src/components/mencoes` | MentionsFeed, MentionCard, InsightsPanel |
| `src/pages` | Login, Dashboard, Liderancas, Eleitores, Mapa, Mencoes, Campo, CampoEntrevista, CampoFaq, Agenda, Equipe, NotFound |
| `src/stores/auth.ts` | Zustand store (sessão persistida no localStorage) |
| `src/hooks` | `useAuth`, `useOnline`, `useGeolocation` |
| `src/lib/supabase.ts` | Client com gate `USE_MOCKS` |
| `src/lib/data.ts` | Coleções (escolhe mock ou Supabase por entidade) + `useCollection` |
| `src/lib/mock-db.ts` | MockCollection — localStorage |
| `src/lib/supabase-collection.ts` | SupabaseCollection — hidratação + realtime + writes otimistas |
| `src/lib/offline-queue.ts` | Fila de entrevistas em localStorage (módulo de campo) |
| `src/lib/insights.ts` | Heurística de insights para o M5 (substitui por chamada Claude real em produção) |
| `src/lib/metrics.ts` | Computa KPIs e timeline do dashboard |
| `src/types/index.ts` | Todos os tipos do domínio + constantes de UI |
| `src/data/faq-seed.ts` | 27 cards de FAQ embarcados (funciona offline) |
| `src/data/municipalities-mg.ts` | Subset de municípios de MG |
| `src/data/municipalities-mg-coords.ts` | Centroides + população para o mapa |
| `src/data/seeds.ts` | Dados mock para todas as coleções |
| `supabase/schema.sql` | DDL + RLS + funções helpers + realtime |
| `supabase/migration-002-provisioning.sql` | Adiciona is_active + must_change_password |
| `supabase/bootstrap.sql` | Cria primeira campanha + liga admin |
| `supabase/seed-faq.sql` | Seed mínimo do FAQ global |
| `supabase/functions/provision-user/` | Edge function: admin cria conta com senha temp |

## Camada de dados (mock vs Supabase)

`src/lib/data.ts` exporta `collections` — um objeto com `MockCollection` ou `SupabaseCollection` para cada entidade, escolhido em tempo de boot pela env `VITE_USE_MOCKS`.

Ambas as classes implementam a interface `Collection<T>` em `src/lib/collection-types.ts`:

- `subscribe / getSnapshot` — usados por `useCollection` (React `useSyncExternalStore`)
- `create / update / remove` — operações sync na UI; o Supabase faz writes otimistas e reconcilia via realtime

**Importante:** todas as policies do RLS chamam `public.current_campaign_id()` para filtrar por campanha — o client nunca precisa (e não deve) enviar `campaign_id` como filtro de segurança. Mas para os `insert`, as páginas continuam passando `campaign_id` e `created_by` explicitamente porque são colunas obrigatórias.

## Status dos módulos

| Módulo | Status |
| --- | --- |
| M1 — Auth (login, store, roles, ProtectedRoute) | ✅ pronto, real + mock |
| M2 — Cadastro de base (lideranças/eleitores) | ✅ pronto |
| M3 — Mapa político (Leaflet + força política) | ✅ pronto (36 municípios principais) |
| M4 — Dashboard (KPIs + Recharts + agenda + alertas) | ✅ pronto |
| M5 — Monitor de menções (feed + insights) | ✅ feed pronto; coleta real depende de edge function adicional |
| M6-A — Questionário de campo (GPS + offline-first) | ✅ pronto |
| M6-B — FAQ argumentação (27 cards, busca, filtro) | ✅ pronto |
| Equipe — provisionamento + ativar/desativar | ✅ pronto (edge function `provision-user`, senha temp 123456) |
| Login Google + troca obrigatória de senha | ✅ pronto |

## Comandos

| Comando | Ação |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Build de produção (`tsc -b && vite build`) |
| `npm run start` | Preview (usado pelo Railway) |
| `npm run typecheck` | TypeScript strict check |

## Multi-tenancy

Cada usuário pertence a uma única `campaign_id` via `campaign_users`. Todas as policies do RLS chamam `public.current_campaign_id()` para filtrar — segurança no banco, não no client.
