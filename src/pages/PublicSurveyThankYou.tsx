// ============================================================================
// PublicSurveyThankYou — /p/:token/obrigado. Página pública mostrada após
// submissão bem-sucedida. Sem session, sem sidebar.
// ============================================================================

import { CheckCircle2 } from 'lucide-react';

export default function PublicSurveyThankYou() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-vortex-bg p-6">
      <div className="max-w-md space-y-4 rounded-lg border border-border/40 bg-card/50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h1 className="font-display text-2xl text-foreground">Obrigado!</h1>
        <p className="text-sm text-muted-foreground">
          Sua resposta foi registrada. Cada opinião ajuda a construir uma campanha mais
          conectada com a realidade da sua região.
        </p>
        <p className="pt-4 text-[10px] uppercase tracking-widest text-muted-foreground">
          Pesquisa via Vórtice
        </p>
      </div>
    </div>
  );
}
