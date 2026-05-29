import { useEffect, useState } from 'react';
import { Loader2, Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioOption } from '@/components/billing/PlanCards';
import {
  CAMPAIGN_QUESTION_TYPE_LABEL,
  type CampaignQuestion,
  type CampaignQuestionType,
} from '@/types';

export interface QuestionFormValues {
  text: string;
  type: CampaignQuestionType;
  options: string[] | null;
  is_required: boolean;
}

const TYPE_ORDER: CampaignQuestionType[] = [
  'yes_no',
  'multiple_choice',
  'single_choice',
  'scale_1_5',
  'free_text',
];

const TYPE_DESCRIPTION: Record<CampaignQuestionType, string> = {
  yes_no: 'Duas opções: Sim ou Não.',
  multiple_choice: 'O entrevistado pode marcar várias opções.',
  single_choice: 'O entrevistado marca apenas uma opção.',
  scale_1_5: 'Nota de 1 a 5.',
  free_text: 'Resposta digitada livremente.',
};

const needsOptions = (t: CampaignQuestionType) =>
  t === 'multiple_choice' || t === 'single_choice';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: CampaignQuestion | null;
  saving: boolean;
  onSave: (values: QuestionFormValues) => void;
}

export function QuestionForm({ open, onOpenChange, initial, saving, onSave }: Props) {
  const [text, setText] = useState('');
  const [type, setType] = useState<CampaignQuestionType>('yes_no');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [isRequired, setIsRequired] = useState(false);

  // Hidrata quando abre (novo = limpo; editar = valores da pergunta).
  useEffect(() => {
    if (!open) return;
    setText(initial?.text ?? '');
    setType(initial?.type ?? 'yes_no');
    setOptions(
      initial && Array.isArray(initial.options) && initial.options.length >= 2
        ? initial.options
        : ['', ''],
    );
    setIsRequired(initial?.is_required ?? false);
  }, [open, initial]);

  function setOption(i: number, v: string) {
    setOptions((arr) => arr.map((o, idx) => (idx === i ? v : o)));
  }

  function submit() {
    const cleanText = text.trim();
    if (cleanText.length < 5) {
      toast.error('A pergunta precisa ter pelo menos 5 caracteres.');
      return;
    }
    let finalOptions: string[] | null = null;
    if (needsOptions(type)) {
      const clean = options.map((o) => o.trim()).filter((o) => o.length > 0);
      if (clean.length < 2) {
        toast.error('Informe pelo menos 2 opções de resposta.');
        return;
      }
      finalOptions = clean;
    }
    onSave({ text: cleanText, type, options: finalOptions, is_required: isRequired });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="mb-5">
          <SheetTitle>
            {initial ? 'Editar pergunta regional' : 'Nova pergunta regional'}
          </SheetTitle>
          <SheetDescription>
            Aparece como bloco final em cada entrevista de campo desta campanha.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="q-text">Texto da pergunta *</Label>
            <Textarea
              id="q-text"
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ex.: O eleitor conhece o Projeto Asfalto Novo?"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de resposta *</Label>
            <div className="space-y-2">
              {TYPE_ORDER.map((t) => (
                <RadioOption
                  key={t}
                  selected={type === t}
                  onSelect={() => setType(t)}
                  title={CAMPAIGN_QUESTION_TYPE_LABEL[t]}
                  description={TYPE_DESCRIPTION[t]}
                />
              ))}
            </div>
          </div>

          {needsOptions(type) ? (
            <div className="space-y-2">
              <Label>Opções de resposta * (mínimo 2)</Label>
              <div className="space-y-2">
                {options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={o}
                      onChange={(e) => setOption(i, e.target.value)}
                      placeholder={`Opção ${i + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setOptions((arr) => arr.filter((_, idx) => idx !== i))}
                      disabled={options.length <= 2}
                      aria-label="Remover opção"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOptions((arr) => [...arr, ''])}
              >
                <Plus className="h-4 w-4" /> Adicionar opção
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Obrigatória?</Label>
            <RadioOption
              selected={isRequired}
              onSelect={() => setIsRequired(true)}
              title="Sim — entrevistador não pode pular"
              description="A entrevista não avança sem responder."
            />
            <RadioOption
              selected={!isRequired}
              onSelect={() => setIsRequired(false)}
              title="Não — opcional"
              description="Pode ser deixada em branco."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar pergunta
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
