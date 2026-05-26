import { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ArrowLeft,
  Save,
  Send,
  Loader2,
  Clock,
  Twitter,
  Instagram,
  Facebook,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Plataforma, RespostaGerada } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  resposta: RespostaGerada;
  draftText: string;
  edited: boolean;
  saving: boolean;
  elapsedSeconds: number;
  onChangeDraft: (text: string) => void;
  onCopy: () => Promise<void>;
  onBack: () => void;
  onApprove: (args: { publicada: boolean; publicada_em: string | null }) => Promise<boolean>;
}

const PLATAFORMAS: Array<{ value: Plataforma; label: string; icon: LucideIcon; maxChars: number }> = [
  { value: 'X', label: 'X (Twitter)', icon: Twitter, maxChars: 280 },
  { value: 'Instagram', label: 'Instagram', icon: Instagram, maxChars: 2200 },
  { value: 'Facebook', label: 'Facebook', icon: Facebook, maxChars: 5000 },
  { value: 'WhatsApp', label: 'WhatsApp', icon: MessageCircle, maxChars: 1000 },
];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}min ${String(s).padStart(2, '0')}s`;
}

export function StepAprovar({
  resposta,
  draftText,
  edited,
  saving,
  elapsedSeconds,
  onChangeDraft,
  onCopy,
  onBack,
  onApprove,
}: Props) {
  const [plataforma, setPlataforma] = useState<Plataforma>('X');
  const selected = PLATAFORMAS.find((p) => p.value === plataforma)!;
  const charsExceeded = draftText.length > selected.maxChars;

  async function handleCopy() {
    await onCopy();
    toast.success('Resposta copiada.');
  }

  async function publish() {
    if (charsExceeded) {
      toast.error(`Excedeu ${selected.maxChars} caracteres do ${selected.label}.`);
      return;
    }
    await onApprove({ publicada: true, publicada_em: plataforma });
  }

  async function saveDraft() {
    await onApprove({ publicada: false, publicada_em: null });
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs uppercase tracking-widest text-emerald-300">
              Passo 5 — Aprovar e registrar
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Revise, ajuste se necessário, e registre como publicada ou salve rascunho.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          {formatElapsed(elapsedSeconds)} desde a menção
        </Badge>
      </header>

      {/* Editor */}
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Estilo: <span className="text-foreground">{resposta.estilo}</span>
            {edited ? (
              <span className="ml-2 text-vortex-violet">· editada por você</span>
            ) : null}
          </p>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
        <Textarea
          rows={6}
          value={draftText}
          onChange={(e) => onChangeDraft(e.target.value)}
          className="text-sm"
        />
        <div className="mt-2 flex items-center justify-between text-xs">
          <span
            className={cn(
              'text-muted-foreground',
              charsExceeded && 'font-semibold text-red-300',
            )}
          >
            {draftText.length} / {selected.maxChars} caracteres
          </span>
          <span className="text-muted-foreground">{resposta.justificativa}</span>
        </div>
      </div>

      {/* Plataforma */}
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/40 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Onde vai publicar?
        </p>
        <div className="flex flex-wrap gap-2">
          {PLATAFORMAS.map((p) => {
            const Icon = p.icon;
            const active = plataforma === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPlataforma(p.value)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-vortex-border bg-vortex-bg/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={saveDraft} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar rascunho
          </Button>
          <Button onClick={publish} disabled={saving || charsExceeded}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Marcar como publicada
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Meta: responder em até 1h para máximo impacto. Tempo registrado: {formatElapsed(elapsedSeconds)}.
      </p>
    </div>
  );
}
