import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { useBrandSync } from '@/hooks/useBrand';
import LoginPage from '@/pages/Login';
import TrocarSenhaPage from '@/pages/TrocarSenha';
import AguardandoAtivacaoPage from '@/pages/AguardandoAtivacao';
import DashboardPage from '@/pages/Dashboard';
import LiderancasPage from '@/pages/Liderancas';
import EleitoresPage from '@/pages/Eleitores';
import MapaPage from '@/pages/Mapa';
import MencoesPage from '@/pages/Mencoes';
import RespostaRapidaPage from '@/pages/RespostaRapida';
import RespostaRapidaHistoricoPage from '@/pages/RespostaRapidaHistorico';
import CampoHubPage from '@/pages/Campo';
import CampoEntrevistaPage from '@/pages/CampoEntrevista';
import CampoFaqPage from '@/pages/CampoFaq';
import CampoHistoricoPage from '@/pages/CampoHistorico';
import CampoHojePage from '@/pages/CampoHoje';
import AgendaPage from '@/pages/Agenda';
import EquipePage from '@/pages/Equipe';
import IntegracoesPage from '@/pages/Integracoes';
import BrandingPage from '@/pages/Branding';
import AdminCampaignsPage from '@/pages/AdminCampaigns';
import AdminCampaignDetailPage from '@/pages/AdminCampaignDetail';
import AdminSettingsPage from '@/pages/AdminSettings';
import NotFoundPage from '@/pages/NotFound';

function BrandSync() {
  useBrandSync();
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <BrandSync />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/trocar-senha" element={<TrocarSenhaPage />} />
          <Route path="/aguardando-ativacao" element={<AguardandoAtivacaoPage />} />
        </Route>

        {/* Rotas da campanha — exigem membership ativo */}
        <Route element={<ProtectedRoute requireCampaign />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/liderancas" element={<LiderancasPage />} />
            <Route path="/eleitores" element={<EleitoresPage />} />
            <Route path="/mapa" element={<MapaPage />} />
            <Route path="/campo" element={<CampoHubPage />} />
            <Route path="/campo/hoje" element={<CampoHojePage />} />
            <Route path="/campo/historico" element={<CampoHistoricoPage />} />
            <Route path="/campo/entrevista" element={<CampoEntrevistaPage />} />
            <Route path="/campo/entrevista/:id" element={<CampoEntrevistaPage />} />
            <Route path="/campo/faq" element={<CampoFaqPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
          </Route>
        </Route>

        <Route
          element={
            <ProtectedRoute
              requireCampaign
              roles={['admin', 'coordinator', 'researcher']}
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

        <Route
          element={<ProtectedRoute requireCampaign roles={['admin', 'coordinator']} />}
        >
          <Route element={<AppLayout />}>
            <Route path="/equipe" element={<EquipePage />} />
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
