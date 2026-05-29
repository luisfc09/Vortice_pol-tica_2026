import { ChevronDown, ChevronUp, GripVertical, Pencil, Power, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CAMPAIGN_QUESTION_TYPE_LABEL, type CampaignQuestion } from '@/types';

interface Props {
  question: CampaignQuestion;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function QuestionCard({
  question,
  index,
  isFirst,
  isLast,
  busy,
  onEdit,
  onToggleActive,
  onDelete,
  onMoveUp,
  onMoveDown,
}: Props) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        question.is_active
          ? 'border-vortex-border bg-vortex-surface/40'
          : 'border-vortex-border/60 bg-vortex-surface/20 opacity-70',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Reordenar: ↑ ↓ (handle visual ⠿) */}
        <div className="flex flex-col items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1"
            onClick={onMoveUp}
            disabled={isFirst || busy}
            aria-label="Subir"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1"
            onClick={onMoveDown}
            disabled={isLast || busy}
            aria-label="Descer"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">
            {index + 1}. {question.text}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{CAMPAIGN_QUESTION_TYPE_LABEL[question.type]}</Badge>
            <Badge variant={question.is_required ? 'default' : 'secondary'}>
              {question.is_required ? 'Obrigatória' : 'Opcional'}
            </Badge>
            <Badge variant={question.is_active ? 'success' : 'warning'}>
              {question.is_active ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
          {Array.isArray(question.options) && question.options.length > 0 ? (
            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              Opções: {question.options.join(' · ')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onEdit} disabled={busy}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
        <Button variant="outline" size="sm" onClick={onToggleActive} disabled={busy}>
          <Power className="h-3.5 w-3.5" /> {question.is_active ? 'Desativar' : 'Ativar'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-300 hover:text-red-200"
          onClick={onDelete}
          disabled={busy}
        >
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </Button>
      </div>
    </div>
  );
}
