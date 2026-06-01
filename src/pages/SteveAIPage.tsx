import { Brain } from 'lucide-react';
import { SteveChat } from '@/components/agents/SteveChat';

export default function SteveAIPage() {
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Brain className="h-4 w-4 text-vortex-violet" />
          <span className="text-xs uppercase tracking-widest text-vortex-violet">
            Visão estratégica
          </span>
        </div>
        <h2 className="font-display text-3xl tracking-wide text-foreground">
          Steve_AI — Estrategista
        </h2>
        <p className="text-sm text-muted-foreground">
          Análise baseada nos dados reais da sua campanha. Histórico salvo por usuário.
        </p>
      </div>
      <SteveChat />
    </div>
  );
}
