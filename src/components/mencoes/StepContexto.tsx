import { Search, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ContextoLegislativo } from '@/types';

interface Props {
  contexto: ContextoLegislativo;
  onChange: (patch: Partial<ContextoLegislativo>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepContexto({ contexto, onChange, onBack, onNext }: Props) {
  return (
    <div className="space-y-4">
      <header>
        <div className="mb-1 flex items-center gap-2">
          <Search className="h-4 w-4 text-amber-400" />
          <span className="text-xs uppercase tracking-widest text-amber-300">
            Passo 3 — Contexto real
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Preencha com os fatos verificáveis. Quanto melhor o contexto, melhor a resposta gerada
          pela IA.
        </p>
      </header>

      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur space-y-4">
        <div className="space-y-2">
          <Label htmlFor="votacao_real">Votação real</Label>
          <Input
            id="votacao_real"
            value={contexto.votacao_real ?? ''}
            onChange={(e) => onChange({ votacao_real: e.target.value })}
            placeholder='Ex: "Votei A FAVOR do PL 1234 — ampliação UBS em março/2023"'
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="presenca_real">Frequência / presença</Label>
          <Input
            id="presenca_real"
            value={contexto.presenca_real ?? ''}
            onChange={(e) => onChange({ presenca_real: e.target.value })}
            placeholder='Ex: "87% de presença em 2023 — acima da média da casa"'
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="projetos">Projetos relacionados</Label>
          <Textarea
            id="projetos"
            rows={2}
            value={contexto.projetos_apresentados ?? ''}
            onChange={(e) => onChange({ projetos_apresentados: e.target.value })}
            placeholder='Ex: "PL 567/2023 — médico especialista em todo município; PL 890/2023 — saúde mental nas escolas"'
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fonte">Fonte verificável</Label>
          <Input
            id="fonte"
            value={contexto.fonte ?? ''}
            onChange={(e) => onChange({ fonte: e.target.value })}
            placeholder='Ex: "ALMG — almg.mg.gov.br/votacoes/15-03-2023"'
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="extra">Contexto adicional</Label>
          <Textarea
            id="extra"
            rows={3}
            value={contexto.contexto_extra ?? ''}
            onChange={(e) => onChange({ contexto_extra: e.target.value })}
            placeholder="Qualquer informação relevante: histórico do autor do ataque, contexto do dia, dados de campanhas anteriores..."
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={onNext}>
          Gerar respostas com este contexto
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Dica: você pode pular qualquer campo. Mas respostas com fonte verificável têm bem mais
        credibilidade.
      </p>
    </div>
  );
}
