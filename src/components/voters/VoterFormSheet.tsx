import { useEffect, useState } from 'react';
import { MapPin, Save, RotateCw, Search, Loader2 } from 'lucide-react';
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
import { AddressFields, type AddressValue } from '@/components/forms/AddressFields';
import { GeoStatusBadge } from '@/components/voters/GeoStatusBadge';
import { collections } from '@/lib/data';
import { formatPhone } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { geocodeAddress, type GeoAccuracy, type GeocodeResult } from '@/lib/geocode';
import { MG_MUNICIPALITIES } from '@/data/municipalities-mg';
import {
  AGE_RANGE_LABEL,
  VOTE_INTENTION_LABEL,
  type AgeRange,
  type GeoSource,
  type Voter,
  type VoteIntention,
} from '@/types';

type FormState = Omit<Voter, 'id' | 'campaign_id' | 'created_by' | 'created_at'>;

const EMPTY: FormState = {
  name: '',
  phone: '',
  address: '',
  city: null,
  neighborhood: null,
  municipality_code: null,
  cep: null,
  logradouro: null,
  numero: null,
  complemento: null,
  vote_intention: 'indeciso',
  age_range: null,
  notes: '',
  lat: null,
  lng: null,
  geo_source: null,
};

interface VoterFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Voter | null;
}

export function VoterFormSheet({ open, onOpenChange, editing }: VoterFormSheetProps) {
  const session = useAuthStore((s) => s.session);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [geoAccuracy, setGeoAccuracy] = useState<GeoAccuracy | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const geo = useGeolocation(open && !editing);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        phone: editing.phone ?? '',
        address: editing.address ?? '',
        city: editing.city,
        neighborhood: editing.neighborhood,
        municipality_code: editing.municipality_code,
        cep: editing.cep,
        logradouro: editing.logradouro,
        numero: editing.numero,
        complemento: editing.complemento,
        vote_intention: editing.vote_intention,
        age_range: editing.age_range ?? null,
        notes: editing.notes ?? '',
        lat: editing.lat,
        lng: editing.lng,
        geo_source: editing.geo_source ?? null,
      });
      // Sem accuracy armazenada: inferimos pelo geo_source quando há coordenadas.
      setGeoAccuracy(
        editing.lat != null && editing.lng != null
          ? editing.geo_source === 'gps'
            ? 'gps'
            : 'address'
          : null,
      );
    } else if (open) {
      setForm(EMPTY);
      setGeoAccuracy(null);
    }
  }, [editing, open]);

  // Ao criar, preenche coordenadas a partir do GPS do dispositivo (fonte primária).
  useEffect(() => {
    if (!editing && geo.lat != null && geo.lng != null) {
      setForm((f) => (f.lat == null ? { ...f, lat: geo.lat, lng: geo.lng, geo_source: 'gps' } : f));
      setGeoAccuracy((acc) => acc ?? 'gps');
    }
  }, [editing, geo.lat, geo.lng]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleMunicipalityChange(code: string, name: string) {
    setForm((f) => ({
      ...f,
      municipality_code: code || null,
      city: code ? name || f.city : f.city,
    }));
  }

  function handleAddressChange(next: AddressValue) {
    setForm((f) => ({ ...f, ...next }));
  }

  // Geocodifica a partir dos campos atuais do formulário e atualiza o estado.
  async function runGeocode(): Promise<GeocodeResult | null> {
    setGeocoding(true);
    try {
      const result = await geocodeAddress({
        logradouro: form.logradouro,
        numero: form.numero,
        neighborhood: form.neighborhood,
        city: form.city,
        uf: 'MG',
        cep: form.cep,
      });
      if (result) {
        setForm((f) => ({ ...f, lat: result.lat, lng: result.lng, geo_source: 'address' }));
        setGeoAccuracy(result.accuracy);
      }
      return result;
    } finally {
      setGeocoding(false);
    }
  }

  async function onManualGeocode() {
    const result = await runGeocode();
    if (!result) toast.error('Não foi possível localizar pelo endereço informado.');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !session.campaign) return;
    if (!form.name.trim()) {
      toast.error('Informe o nome.');
      return;
    }
    if (!form.municipality_code) {
      toast.error('Selecione o município.');
      return;
    }
    const muniName = MG_MUNICIPALITIES.find((m) => m.code === form.municipality_code)?.name;

    // Fallback: sem coordenadas (GPS negado/ausente) → tenta geocodificar pelo endereço.
    let lat = form.lat;
    let lng = form.lng;
    let geoSource: GeoSource | null = form.geo_source ?? (lat != null ? 'gps' : null);
    if (lat == null || lng == null) {
      const result = await runGeocode();
      if (result) {
        lat = result.lat;
        lng = result.lng;
        geoSource = 'address';
      } else {
        geoSource = null;
      }
    }

    const payload = {
      ...form,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
      city: muniName ?? form.city ?? null,
      neighborhood: form.neighborhood?.trim() || null,
      cep: form.cep?.trim() || null,
      logradouro: form.logradouro?.trim() || null,
      numero: form.numero?.trim() || null,
      complemento: form.complemento?.trim() || null,
      lat,
      lng,
      geo_source: geoSource,
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
            Registro de contato com eleitor. Coordenadas vêm do GPS ou, na falta dele, do endereço.
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
            <Label>Faixa etária</Label>
            <Select
              value={form.age_range ?? 'none'}
              onValueChange={(v) => update('age_range', v === 'none' ? null : (v as AgeRange))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não informado</SelectItem>
                {(Object.keys(AGE_RANGE_LABEL) as AgeRange[]).map((a) => (
                  <SelectItem key={a} value={a}>
                    {AGE_RANGE_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Município</Label>
            <MunicipalityCombobox
              value={form.municipality_code ?? ''}
              onChange={handleMunicipalityChange}
              placeholder="Buscar município…"
            />
          </div>

          <AddressFields
            value={{
              cep: form.cep,
              logradouro: form.logradouro,
              numero: form.numero,
              complemento: form.complemento,
              neighborhood: form.neighborhood,
              city: form.city,
              municipality_code: form.municipality_code,
            }}
            onChange={handleAddressChange}
          />

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
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" /> Localização
              </span>
              <div className="flex items-center gap-1">
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
                        update('geo_source', 'gps');
                        setGeoAccuracy('gps');
                      }
                    }}
                  >
                    <RotateCw className="h-3 w-3" /> GPS
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={geocoding}
                  onClick={onManualGeocode}
                >
                  {geocoding ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Search className="h-3 w-3" />
                  )}{' '}
                  Endereço
                </Button>
              </div>
            </div>
            <GeoStatusBadge accuracy={geoAccuracy} />
            <p className="mt-2 text-muted-foreground">
              {form.lat != null && form.lng != null
                ? `${form.lat.toFixed(5)}, ${form.lng.toFixed(5)}`
                : geo.loading
                  ? 'Obtendo GPS…'
                  : 'Sem coordenadas — tentaremos localizar pelo endereço ao salvar.'}
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={geocoding}>
              {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
