// ============================================================================
// AplicarPesquisaPage — lista os formulários que o entrevistador está
// autorizado a aplicar (migration 052, Fase 2). Cada um abre o preenchimento.
// ============================================================================

import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FileStack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/data/EmptyState';
import { useMyAssignedForms } from '@/hooks/useMyAssignedForms';

export default function AplicarPesquisaPage() {
  const { forms, loading } = useMyAssignedForms();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link to="/campo">
          <ArrowLeft className="h-4 w-4" /> Voltar para Pesquisas
        </Link>
      </Button>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-widest text-primary">Pesquisas</span>
        </div>
        <h2 className="font-display text-3xl tracking-wide text-foreground">
          Aplicar Formulário
        </h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Formulários que você foi autorizado a aplicar em campo. Toque em um para começar.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : forms.length === 0 ? (
        <EmptyState
          title="Nenhum formulário disponível."
          description="Você ainda não foi autorizado a aplicar nenhum formulário. Peça ao administrador da campanha."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {forms.map((f) => (
            <Link key={f.id} to={`/campo/aplicar/${f.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base leading-tight">
                    <FileStack className="h-4 w-4 shrink-0 text-primary" />
                    {f.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {f.description ? <p className="line-clamp-2">{f.description}</p> : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
