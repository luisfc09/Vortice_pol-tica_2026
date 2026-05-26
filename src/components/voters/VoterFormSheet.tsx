import { useEffect, useState } from 'react';
import { MapPin, Save, RotateCw } from 'lucide-react';
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
import { MunicipalityCombobox } from '@/components/ui/municipality-combobox';
import { collections } from '@/lib/data';
import { formatPhone } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { VOTE_INTENTION_LABEL, type Voter, type VoteIntention } from '@/types';

type FormState = Omit<Voter, 'id' | 'campaign_id' | 'created_by' | 'created_at'>;

const EMPTY: FormState = {
  name: '',
  phone: '',
  address: '',
  city: '',
  municipality_code: '',
  vote_intention: 'indeciso',
  notes: '',
  lat: null,
  lng: null,
};

interface VoterFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Voter | null;
}

export function VoterFormSheet({ open, onOpenChange, editing }: VoterFormSheetProps) {
  const session = useAuthStore((s) => s.session);
  const [form, setForm] = useState<FormState>(EMPTY);
  const geo = useGeolocation(open && !editing);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        phone: editing.phone ?? '',
        address: editing.address ?? '',
        city: editing.city,
        municipality_code: editing.municipality_code ?? '',
        vote_intention: editing.vote_intention,
        notes: editing.notes ?? '',
        lat: editing.lat,
        lng: editing.lng,
      });
    } else if (open) {
      setForm(EMPTY);
    }
  }, [editing, open]);

  // When creating, auto-fill coordinates from the device GPS.
  useEffect(() => {
    if (!editing && geo.lat != null && geo.lng != null) {
      setForm((f) => (f.lat == null ? { ...f, lat: geo.lat, lng: geo.lng } : f));
    }
  }, [editing, geo.lat, geo.lng]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleMunicipalityChange(code: string, name: string) {
    setForm((f) => ({
      ...f,
      municipality_code: code || null,
      city: f.city || name || '',
    }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !session.campaign) return;
    if (!form.name.trim() || !form.city.trim()) {
      toast.error('Informe nome e cidade.');
      return;
    }
    const payload = {
      ...form,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
      municipality_code: form.municipality_code || null,
    };
    if (editing) {
      collections.voters.update(editing.id, payload);
      toast.success('Eleitor atualizado.');
    } else {
      collections.voters.create({
        data: {
          ...payload,
          campaign_id: session.campaign.id,
          created_by: session.id,
        },
      });
      toast.success('Eleitor cadastrado.');
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-5">
          <SheetTitle>{editing ? 'Editar eleitor' : 'Novo eleitor'}</SheetTitle>
          <SheetDescription>
            Registro de contato com eleitor. Coordenadas são capturadas automaticamente.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                inputMode="tel"
                value={form.phone ?? ''}
                onChange={(e) => update('phone', formatPhone(e.target.value))}
                placeholder="(31) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label>Intenção de voto</Label>
              <Select
                value={form.vote_intention}
                onValueChange={(v) => update('vote_intention', v as VoteIntention)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(VOTE_INTENTION_LABEL) as VoteIntention[]).map((v) => (
                    <SelectItem key={v} value={v}>
                      {VOTE_INTENTION_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              value={form.address ?? ''}
              onChange={(e) => update('address', e.target.value)}
              placeholder="Rua, número, complemento"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Município</Label>
              <MunicipalityCombobox
                value={form.municipality_code ?? ''}
                onChange={handleMunicipalityChange}
                placeholder="Buscar município…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => update('notes', e.target.value)}
            />
          </div>

          <div className="rounded-lg border border-vortex-border bg-vortex-surface/40 p-3 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" /> Coordenadas
              </span>
              {!editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    if (geo.lat != null && geo.lng != null) {
                      update('lat', geo.lat);
                      update('lng', geo.lng);
                    }
                  }}
                >
                  <RotateCw className="h-3 w-3" /> Atualizar
                </Button>
              ) : null}
            </div>
            <p className="text-muted-foreground">
              {form.lat != null && form.lng != null
                ? `${form.lat.toFixed(5)}, ${form.lng.toFixed(5)}`
                : geo.loading
                  ? 'Obtendo GPS...'
                  : geo.error ?? 'Sem coordenadas — registro será salvo sem GPS.'}
            </p>
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
