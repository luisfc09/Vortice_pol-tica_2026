import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Map,
  Megaphone,
  ClipboardList,
  Calendar,
  UsersRound,
  Shield,
  Building2,
  Settings,
  Plug,
  Palette,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useBrand } from '@/hooks/useBrand';
import type { UserRole } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[];
  requiresSuperAdmin?: boolean;
  requiresCampaign?: boolean;
}

const ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresCampaign: true },
  { to: '/liderancas', label: 'Lideranças', icon: Users, requiresCampaign: true },
  { to: '/eleitores', label: 'Eleitores', icon: UserCheck, requiresCampaign: true },
  { to: '/mapa', label: 'Mapa político', icon: Map, requiresCampaign: true },
  {
    to: '/mencoes',
    label: 'Menções',
    icon: Megaphone,
    roles: ['admin', 'coordinator', 'researcher'],
    requiresCampaign: true,
  },
  { to: '/campo', label: 'Campo', icon: ClipboardList, requiresCampaign: true },
  { to: '/agenda', label: 'Agenda', icon: Calendar, requiresCampaign: true },
  {
    to: '/equipe',
    label: 'Equipe',
    icon: UsersRound,
    roles: ['admin', 'coordinator'],
    requiresCampaign: true,
  },
  {
    to: '/integracoes',
    label: 'Integrações',
    icon: Plug,
    roles: ['admin', 'coordinator'],
    requiresCampaign: true,
  },
  {
    to: '/campanha/branding',
    label: 'Identidade',
    icon: Palette,
    roles: ['admin', 'coordinator'],
    requiresCampaign: true,
  },
  { to: '/admin/campaigns', label: 'Campanhas', icon: Building2, requiresSuperAdmin: true },
  { to: '/admin/settings', label: 'Configurações', icon: Settings, requiresSuperAdmin: true },
];

interface SidebarProps {
  role: UserRole | null;
  isSuperAdmin: boolean;
  candidateName: string;
  partyNumber: string;
  onNavigate?: () => void;
}

export function Sidebar({
  role,
  isSuperAdmin,
  candidateName,
  partyNumber,
  onNavigate,
}: SidebarProps) {
  const { logoUrl } = useBrand();
  const visible = ITEMS.filter((item) => {
    if (item.requiresSuperAdmin) return isSuperAdmin;
    if (item.requiresCampaign && role === null) return false;
    if (item.roles && role && !item.roles.includes(role)) return false;
    return true;
  });

  return (
    <aside className="flex h-full w-full flex-col bg-vortex-surface/60 backdrop-blur md:w-64 md:border-r md:border-vortex-border">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-vortex-surface/60">
          <BrandLogo size={32} />
        </div>
        <div className="min-w-0 leading-tight">
          {logoUrl ? (
            <>
              <p className="truncate font-display text-xl tracking-wide text-foreground">
                {candidateName}
              </p>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {partyNumber} · powered by Vórtice
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-2xl tracking-[0.15em] text-foreground">
                V<span className="text-vortex-lime">Ó</span>RTICE
              </p>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {candidateName} · {partyNumber}
              </p>
            </>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 pb-6">
        {visible
          .filter((it) => !it.requiresSuperAdmin)
          .map((item) => (
            <NavRow key={item.to} item={item} onNavigate={onNavigate} />
          ))}

        {isSuperAdmin ? (
          <div className="pt-5">
            <div className="mb-2 flex items-center gap-2 px-3 text-[10px] uppercase tracking-widest text-vortex-violet">
              <Shield className="h-3 w-3" />
              Admin Vórtice
            </div>
            {visible
              .filter((it) => it.requiresSuperAdmin)
              .map((item) => (
                <NavRow key={item.to} item={item} onNavigate={onNavigate} admin />
              ))}
          </div>
        ) : null}
      </nav>

      <div className="border-t border-vortex-border px-5 py-4 text-[11px] text-muted-foreground">
        <p>Eleições 2026 · MG</p>
      </div>
    </aside>
  );
}

function NavRow({
  item,
  onNavigate,
  admin,
}: {
  item: NavItem;
  onNavigate?: () => void;
  admin?: boolean;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? admin
              ? 'bg-vortex-violet/15 text-vortex-violet'
              : 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-vortex-surface hover:text-foreground',
        )
      }
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </NavLink>
  );
}
