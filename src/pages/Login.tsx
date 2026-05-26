import { Navigate } from 'react-router-dom';
import { LoginForm } from '@/components/auth/LoginForm';
import { VorticeLogo } from '@/components/brand/VorticeLogo';
import { useAuthStore } from '@/stores/auth';

export default function LoginPage() {
  const session = useAuthStore((s) => s.session);
  if (session) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-vortex-surface/40 vortex-glow">
            <VorticeLogo size={56} />
          </div>
          <h1 className="font-display text-5xl tracking-[0.15em] text-foreground">
            V<span className="text-vortex-lime">Ó</span>RTICE
          </h1>
          <p className="mt-2 text-sm italic text-muted-foreground">
            Estratégia que move eleições.
          </p>
        </div>

        <div className="rounded-2xl border border-vortex-border bg-vortex-surface/70 p-6 shadow-xl backdrop-blur sm:p-8">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
