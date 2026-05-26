import { CheckCircle2, BarChart3, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FAQ_CATEGORY_LABEL, type FaqCategory } from '@/types';

interface FaqCardProps {
  category: FaqCategory;
  question: string;
  suggestedAnswer: string;
  supportData: string;
  avoidSaying: string;
}

export function FaqCard({
  category,
  question,
  suggestedAnswer,
  supportData,
  avoidSaying,
}: FaqCardProps) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug text-foreground">{question}</h3>
        <Badge variant="outline" className="shrink-0">
          {FAQ_CATEGORY_LABEL[category]}
        </Badge>
      </div>

      <div className="space-y-3 text-sm">
        <Section
          icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
          label="Resposta sugerida"
          body={suggestedAnswer}
        />
        <Section
          icon={<BarChart3 className="h-4 w-4 text-emerald-400" />}
          label="Dado de apoio"
          body={supportData}
        />
        <Section
          icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
          label="O que não dizer"
          body={avoidSaying}
        />
      </div>
    </div>
  );
}

function Section({
  icon,
  label,
  body,
}: {
  icon: React.ReactNode;
  label: string;
  body: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-foreground/90">{body}</p>
    </div>
  );
}
