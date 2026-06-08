import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { useBrandSync } from '@/hooks/useBrand';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { resolveHomeRoute } from '@/lib/homeRoute';
import LoginPage from '@/pages/Login';
import ConvitePage from '@/pages/Convite';
import MinhaRedePage from '@/pages/MinhaRede';
import TrocarSenhaPage from '@/pages/TrocarSenha';
import AguardandoAtivacaoPage from '@/pages/AguardandoAtivacao';
import RenovarPage from '@/pages/Renovar';
import DashboardPage from '@/pages/Dashboard';
import LiderancasPage from '@/pages/Liderancas';
import EleitoresPage from '@/pages/Eleitores';
import MapaPage from '@/pages/Mapa';
import MencoesPage from '@/pages/Mencoes';
import RespostaRapidaPage from '@/pages/RespostaRapida';
import RespostaRapidaHistoricoPage from '@/pages/RespostaRapidaHistorico';
import CampoHubPage from '@/pages/Campo';
import PerguntasRegionaisPage from '@/pages/PerguntasRegionaisPage';
import OnboardingPage from '@/pages/Onboarding';
import CampoEntrevistaPage from '@/pages/CampoEntrevista';
import CampoEntrevistaDetalhePage from '@/pages/CampoEntrevistaDetalhe';
import InteligenciaPage from '@/pages/Inteligencia';
import VeraIAPage from '@/pages/VeraIAPage';
import CampoQuestionarioPage from '@/pages/CampoQuestionario';
import CampoFaqPage from '@/pages/CampoFaq';
import CampoHistoricoPage from '@/pages/CampoHistorico';
import CampoHojePage from '@/pages/CampoHoje';
import AgendaPage from '@/pages/Agenda';
import UsuariosPage from '@/pages/Usuarios';
import IntegracoesPage from '@/pages/Integracoes';
import BrandingPage from '@/pages/Branding';
import AdminCampaignsPage from '@/pages/AdminCampaigns';
import AdminCampaignDetailPage from '@/pages/AdminCampaignDetail';
import AdminSettingsPage from '@/pages/AdminSettings';
import NotFoundPage from '@/pages/NotFound';

// Code-split do módulo Financeiro — a página depende da lib `xlsx` (~600KB
// minified) usada pelo importador de planilhas. Carregar sob demanda evita
// inchar o bundle inicial pra usuários que não abrem essa tela.
const FinanceiroPage = lazy(() => import('@/pages/Financeiro'));

function BrandSync() {
  useBrandSync();
  return null;
}

function LazyFallback() {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Resolve a "home" do user baseado no role. Usa o helper único de
 * src/lib/homeRoute.ts — mesma fonte usada por ProtectedRoute, TrocarSenha
 * e AguardandoAtivacao (single source of truth pra evitar dessincroniza).
 *
 * Renderizado apenas dentro do <ProtectedRoute requireCampaign>, então
 * session.role sempre existe quando este componente roda.
 */
function HomeRedirect() {
  const session = useEffectiveSession();
  return <Navigate to={resolveHomeRoute(session?.role)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <BrandSync />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Migration 047 — convite descartável. Rota pública: qualquer um
            com o link pode aceitar e criar conta. Vem ANTES do ProtectedRoute. */}
        <Route path="/convite/:code" element={<ConvitePage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/trocar-senha" element={<TrocarSenhaPage />} />
          <Route path="/aguardando-ativacao" element={<AguardandoAtivacaoPage />} />
          <Route path="/renovar" element={<RenovarPage />} />
        </Route>

        {/* ------------------------------------------------------------------
            Rotas da campanha — exigem membership ativo.
            Matriz completa de permissões por role implementada via sub-grupos
            de ProtectedRoute — cada bloco abaixo lista os roles permitidos
            naquela rota. ProtectedRoute redireciona para `fallbackHome` quando
            o role do user NÃO está na lista (supporter→/minha-rede,
            leader→/agenda, demais→/dashboard).

            Quem pode o quê (ver docs/DOCUMENTACAO-TECNICA.md §6.5):

              Rota               | adm | cand | coord | res | sup | lead | field
              -------------------|-----|------|-------|-----|-----|------|------
              /dashboard         |  ✅ |  ✅  |  ✅   | ✅  |  ❌ |  ❌  |  ✅
              /inteligencia      |  ✅ |  ✅  |  ✅   | ✅  |  ❌ |  ❌  |  ✅
              /financeiro        |  ✅ |  ✅  |  ✅   | ❌  |  ❌ |  ❌  |  ❌
              /liderancas        |  ✅ |  ✅  |  ✅   | ❌  |  ❌ |  ✅  |  ❌
              /eleitores, /mapa  |  ✅ |  ✅  |  ✅   | ✅  |  ❌ |  ✅  |  ✅
              /campo/*           |  ✅ |  ❌  |  ✅   | ✅  |  ❌ |  ❌  |  ✅
              /agentes/vera      |  ✅ |  ✅  |  ❌   | ❌  |  ❌ |  ❌  |  ❌
              /mencoes/*         |  ✅ |  ✅  |  ✅   | ✅  |  ❌ |  ❌  |  ❌
              /perguntas-region. |  ✅ |  ❌  |  ✅   | ❌  |  ❌ |  ❌  |  ❌
              /onboarding        |  ✅ |  ❌  |  ❌   | ❌  |  ❌ |  ❌  |  ❌
              /usuarios, /integr.|  ✅ |  ❌  |  ✅   | ❌  |  ❌ |  ❌  |  ❌
              /campanha/branding |  ✅ |  ❌  |  ✅   | ❌  |  ❌ |  ❌  |  ❌
              /minha-rede        |  ❌ |  ❌  |  ❌   | ❌  |  ✅ |  ✅  |  ❌
              /agenda            |  ✅ |  ✅  |  ✅   | ✅  |  ✅ |  ✅  |  ✅
              /admin/*           |  super_admin only (qualquer role base)
            ------------------------------------------------------------------ */}

        {/* Universal — abertos a TODOS os roles da campanha (inclui supporter
            e leader). HomeRedirect resolve "/" por role. */}
        <Route element={<ProtectedRoute requireCampaign />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/agenda" element={<AgendaPage />} />
          </Route>
        </Route>

        {/* Dashboard + Inteligência — 5 roles (sem supporter, sem leader) */}
        <Route
          element={
            <ProtectedRoute
              requireCampaign
              roles={['admin', 'candidate', 'coordinator', 'researcher', 'field_agent']}
            />
          }
        >
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/inteligencia" element={<InteligenciaPage />} />
          </Route>
        </Route>

        {/* Financeiro — apenas admin, candidate, coordinator */}
        <Route
          element={
            <ProtectedRoute
              requireCampaign
              roles={['admin', 'candidate', 'coordinator']}
            />
          }
        >
          <Route element={<AppLayout />}>
            <Route
              path="/financeiro"
              element={
                <Suspense fallback={<LazyFallback />}>
                  <FinanceiroPage />
                </Suspense>
              }
            />
          </Route>
        </Route>

        {/* Lideranças — admin, candidate, coordinator, leader.
            Researcher e field_agent ficam de fora (não cadastram pirâmide).
            Supporter usa /minha-rede pra ver a própria sub-árvore. */}
        <Route
          element={
            <ProtectedRoute
              requireCampaign
              roles={['admin', 'candidate', 'coordinator', 'leader']}
            />
          }
        >
          <Route element={<AppLayout />}>
            <Route path="/liderancas" element={<LiderancasPage />} />
          </Route>
        </Route>

        {/* Eleitores + Mapa — 6 roles (sem supporter). /eleitores é fallback
            legado mantido pra bookmarks antigos; navegação real é via /mapa. */}
        <Route
          element={
            <ProtectedRoute
              requireCampaign
              roles={[
                'admin',
                'candidate',
                'coordinator',
                'researcher',
                'leader',
                'field_agent',
              ]}
            />
          }
        >
          <Route element={<AppLayout />}>
            <Route path="/eleitores" element={<EleitoresPage />} />
            <Route path="/mapa" element={<MapaPage />} />
          </Route>
        </Route>

        {/* Campo / Pesquisas — admin, coordinator, researcher, field_agent.
            Candidate e leader não acessam (entrevistas são trabalho de campo
            operacional). */}
        <Route
          element={
            <ProtectedRoute
              requireCampaign
              roles={['admin', 'coordinator', 'researcher', 'field_agent']}
            />
          }
        >
          <Route element={<AppLayout />}>
            <Route path="/campo" element={<CampoHubPage />} />
            <Route path="/campo/hoje" element={<CampoHojePage />} />
            <Route path="/campo/historico" element={<CampoHistoricoPage />} />
            {/* Redirect legados — links antigos seguem funcionando */}
            <Route
              path="/campo/minhas-entrevistas"
              element={<Navigate to="/campo/historico" replace />}
            />
            <Route
              path="/campo/regionais"
              element={<Navigate to="/pesquisas/perguntas-regionais" replace />}
            />
            <Route path="/campo/entrevista" element={<CampoEntrevistaPage />} />
            <Route path="/campo/entrevista/:id" element={<CampoEntrevistaPage />} />
            <Route
              path="/campo/entrevista/:id/ver"
              element={<CampoEntrevistaDetalhePage />}
            />
            <Route
              path="/campo/entrevista/:id/questionario"
              element={<CampoQuestionarioPage />}
            />
            <Route path="/campo/faq" element={<CampoFaqPage />} />
          </Route>
        </Route>

        {/* Minha Rede — supporter + leader (Migration 047 — Fase 2 hierarquia).
            Leader também tem sub-árvore própria (pessoas que ele indicou). */}
        <Route
          element={<ProtectedRoute requireCampaign roles={['supporter', 'leader']} />}
        >
          <Route element={<AppLayout />}>
            <Route path="/minha-rede" element={<MinhaRedePage />} />
          </Route>
        </Route>

        {/* Vera_IA — estrategista (admin e candidato apenas) */}
        <Route element={<ProtectedRoute requireCampaign roles={['admin', 'candidate']} />}>
          <Route element={<AppLayout />}>
            <Route path="/agentes/vera" element={<VeraIAPage />} />
            {/* Redirect legado: bookmarks antigos /agentes/steve continuam funcionando */}
            <Route path="/agentes/steve" element={<Navigate to="/agentes/vera" replace />} />
          </Route>
        </Route>

        {/* Menções + Resposta Rápida — admin, candidate, coordinator, researcher */}
        <Route
          element={
            <ProtectedRoute
              requireCampaign
              roles={['admin', 'candidate', 'coordinator', 'researcher']}
            />
          }
        >
          <Route element={<AppLayout />}>
            <Route path="/mencoes" element={<MencoesPage />} />
            <Route path="/mencoes/resposta-rapida" element={<RespostaRapidaPage />} />
            <Route
              path="/mencoes/resposta-rapida/historico"
              element={<RespostaRapidaHistoricoPage />}
            />
          </Route>
        </Route>

        {/* Perguntas regionais — admin + coordinator (setup de pesquisa) */}
        <Route
          element={<ProtectedRoute requireCampaign roles={['admin', 'coordinator']} />}
        >
          <Route element={<AppLayout />}>
            <Route
              path="/pesquisas/perguntas-regionais"
              element={<PerguntasRegionaisPage />}
            />
          </Route>
        </Route>

        {/* Onboarding — só admin (setup inicial da campanha) */}
        <Route element={<ProtectedRoute requireCampaign roles={['admin']} />}>
          <Route element={<AppLayout />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>
        </Route>

        <Route
          element={<ProtectedRoute requireCampaign roles={['admin', 'coordinator']} />}
        >
          <Route element={<AppLayout />}>
            <Route path="/usuarios" element={<UsuariosPage />} />
            {/* Compat: link antigo /equipe ainda funciona */}
            <Route path="/equipe" element={<Navigate to="/usuarios" replace />} />
            <Route path="/integracoes" element={<IntegracoesPage />} />
            <Route path="/campanha/branding" element={<BrandingPage />} />
          </Route>
        </Route>

        {/* Rotas do super admin Vórtice */}
        <Route element={<ProtectedRoute requireSuperAdmin />}>
          <Route element={<AppLayout />}>
            <Route path="/admin" element={<Navigate to="/admin/campaigns" replace />} />
            <Route path="/admin/campaigns" element={<AdminCampaignsPage />} />
            <Route path="/admin/campaigns/:id" element={<AdminCampaignDetailPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
