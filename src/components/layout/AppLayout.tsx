import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { TrialBanner } from './TrialBanner';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { setActiveCampaignId } from '@/lib/data';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/liderancas': 'Lideranças',
  '/eleitores': 'Eleitores',
  '/mapa': 'Mapa Eleitoral',
  '/mencoes': 'Monitor de menções',
  '/mencoes/resposta-rapida': 'Resposta Rápida',
  '/mencoes/resposta-rapida/historico': 'Histórico de respostas',
  '/campo': 'Pesquisas',
  '/campo/hoje': 'Campo Hoje',
  '/campo/entrevista': 'Nova entrevista',
  '/campo/faq': 'FAQ de argumentação',
  '/agenda': 'Agenda do candidato',
  '/inteligencia': 'Inteligência Eleitoral',
  '/usuarios': 'Usuários',
  '/equipe': 'Usuários', // legado
  '/campo/historico': 'Minhas entrevistas',
  '/campo/entrevista/questionario': 'Questionário aprofundado',
  '/campo/entrevista/ver': 'Entrevista completa',
  '/integracoes': 'Integrações',
  '/campanha/branding': 'Identidade da campanha',
  '/admin/campaigns': 'Admin Vórtice — Campanhas',
  '/admin/settings': 'Admin Vórtice — Configurações',
  '/admin': 'Admin Vórtice',
};

export function AppLayout() {
  // useEffectiveSession já considera o view-as do super admin.
  const session = useEffectiveSession();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const title = useMemo(() => {
    if (TITLES[location.pathname]) return TITLES[location.pathname];
    const match = Object.keys(TITLES)
      .filter((key) => location.pathname.startsWith(key))
      .sort((a, b) => b.length - a.length)[0];
    return match ? TITLES[match] : 'Vórtice';
  }, [location.pathname]);

  // Escopo de dados: amarra TODAS as coleções à campanha efetiva (respeita o
  // "ver como cliente" do super admin). Trocar de campanha re-hidrata tudo no
  // escopo certo — impede que dados de uma campanha apareçam em outra.
  const effectiveCampaignId = session?.campaign?.id ?? null;
  useEffect(() => {
    setActiveCampaignId(effectiveCampaignId);
  }, [effectiveCampaignId]);

  if (!session) return null;

  const sidebarProps = {
    role: session.role,
    isSuperAdmin: session.is_super_admin,
    candidateName: session.campaign?.candidate_name ?? 'Vórtice (Admin)',
    partyNumber: session.campaign?.party_number ?? '—',
    plan: session.campaign?.plan ?? null,
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <Sidebar {...sidebarProps} />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-vortex-border p-0">
          <Sidebar {...sidebarProps} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-screen flex-1 flex-col">
        <TrialBanner />
        <Header title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
