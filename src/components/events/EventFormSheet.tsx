import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { collections } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';
import type { CampaignEvent, EventType } from '@/types';

const TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: 'comicio', label: 'Comício' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'visita', label: 'Visita' },
  { value: 'midia', label: 'Mídia' },
  { value: 'outro', label: 'Outro' },
];

interface FormState {
  title: string;
  type: EventType;
  date: string; // local datetime input
  location: string;
  city: string;
  description: string;
}

const EMPTY: FormState = {
  title: '',
  type: 'outro',
  date: '',
  location: '',
  city: '',
  description: '',
};

function toLocalInput(value: string): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CampaignEvent | null;
}

export function EventFormSheet({ open, onOpenChange, editing }: Props) {
  const session = useAuthStore((s) => s.session);
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title,
        type: editing.type,
        date: toLocalInput(editing.date),
        location: editing.location ?? '',
        city: editing.city ?? '',
        description: editing.description ?? '',
      });
    } else if (open) {
      setForm(EMPTY);
    }
  }, [editing, open]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !session.campaign) return;
    if (!form.title.trim() || !form.date) {
      toast.error('Informe título e data.');
      return;
    }
    const iso = new Date(form.date).toISOString();
    const payload = {
      title: form.title.trim(),
      type: form.type,
      date: iso,
      location: form.location || null,
      city: form.city || null,
      description: form.description || null,
    };
    if (editing) {
      collections.events.update(editing.id, payload);
      toast.success('Evento atualizado.');
    } else {
      collections.events.create({
        data: {
          ...payload,
          campaign_id: session.campaign.id,
          created_by: session.id,
        },
      });
      toast.success('Evento criado.');
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-5">
          <SheetTitle>{editing ? 'Editar evento' : 'Novo evento'}</SheetTitle>
          <SheetDescription>
            Agenda do candidato. Comícios, reuniões, visitas e compromissos de mídia.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => update('type', v as EventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data e hora</Label>
              <Input
                id="date"
                type="datetime-local"
                value={form.date}
                onChange={(e) => update('date', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Local</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
