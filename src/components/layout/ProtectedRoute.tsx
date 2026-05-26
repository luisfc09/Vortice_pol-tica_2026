import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  roles?: UserRole[];
  requireSuperAdmin?: boolean;
  requireCampaign?: boolean;
}

export function ProtectedRoute({
  roles,
  requireSuperAdmin = false,
  requireCampaign = false,
}: ProtectedRouteProps) {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Force password change before anything else
  if (session.profile.must_change_password && location.pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />;
  }

  if (requireSuperAdmin && !session.is_super_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireCampaign && !session.campaign) {
    // Super admin sem campanha vai para /admin/campaigns
    if (session.is_super_admin) {
      return <Navigate to="/admin/campaigns" replace />;
    }
    // Usuário comum logou mas ainda não foi vinculado → tela de espera
    return <Navigate to="/aguardando-ativacao" replace />;
  }

  if (roles && roles.length > 0) {
    if (!session.role || !roles.includes(session.role)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
}
