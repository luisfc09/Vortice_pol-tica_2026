import { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { TrialBanner } from './TrialBanner';
import { useAuthStore } from '@/stores/auth';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/liderancas': 'Lideranças',
  '/eleitores': 'Eleitores',
  '/mapa': 'Mapa político',
  '/mencoes': 'Monitor de menções',
  '/mencoes/resposta-rapida': 'Resposta Rápida',
  '/mencoes/resposta-rapida/historico': 'Histórico de respostas',
  '/campo': 'Campo',
  '/campo/hoje': 'Campo Hoje',
  '/campo/entrevista': 'Nova entrevista',
  '/campo/faq': 'FAQ de argumentação',
  '/agenda': 'Agenda do candidato',
  '/usuarios': 'Usuários',
  '/equipe': 'Usuários', // legado
  '/campo/historico': 'Minhas entrevistas',
  '/integracoes': 'Integrações',
  '/campanha/branding': 'Identidade da campanha',
  '/admin/campaigns': 'Admin Vórtice — Campanhas',
  '/admin/settings': 'Admin Vórtice — Configurações',
  '/admin': 'Admin Vórtice',
};

export function AppLayout() {
  const session = useAuthStore((s) => s.session);
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const title = useMemo(() => {
    if (TITLES[location.pathname]) return TITLES[location.pathname];
    const match = Object.keys(TITLES)
      .filter((key) => location.pathname.startsWith(key))
      .sort((a, b) => b.length - a.length)[0];
    return match ? TITLES[match] : 'Vórtice';
  }, [location.pathname]);

  if (!session) return null;

  const sidebarProps = {
    role: session.role,
    isSuperAdmin: session.is_super_admin,
    candidateName: session.campaign?.candidate_name ?? 'Vórtice (Admin)',
    partyNumber: session.campaign?.party_number ?? '—',
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
