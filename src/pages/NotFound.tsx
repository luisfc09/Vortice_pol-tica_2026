import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-display text-7xl tracking-wide text-primary">404</p>
      <p className="text-muted-foreground">Página não encontrada.</p>
      <Button asChild>
        <Link to="/dashboard">Voltar ao dashboard</Link>
      </Button>
    </div>
  );
}
