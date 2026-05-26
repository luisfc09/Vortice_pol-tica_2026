import { useEffect, useMemo, useState } from 'react';
import { MapPin, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MunicipalityCombobox } from '@/components/ui/municipality-combobox';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useOnline } from '@/hooks/useOnline';
import { useAuthStore } from '@/stores/auth';
import { collections } from '@/lib/data';
import { enqueueInterview } from '@/lib/offline-queue';
import { formatPhone } from '@/lib/utils';
import {
  PRIORITY_THEMES,
  VOTE_INTENTION_LABEL,
  type FieldInterview,
  type FieldInterviewInput,
  type VoteIntention,
} from '@/types';

const RECEPTIVITY_LABELS = ['Muito baixa', 'Baixa', 'Neutra', 'Boa', 'Excelente'];

const EMPTY: FieldInterviewInput = {
  voter_name: '',
  voter_phone: '',
  neighborhood: '',
  municipality_code: '',
  vote_intention: 'indeciso',
  receptivity_score: 3,
  priority_themes: [],
  vote_decided: false,
  notes: '',
  lat: null,
  lng: null,
};

interface InterviewFormProps {
  editing?: FieldInterview | null;
  onSaved?: () => void;
}

export function InterviewForm({ editing = null, onSaved }: InterviewFormProps) {
  const session = useAuthStore((s) => s.session);
  const online = useOnline();
  // Em modo "editar" não queremos atropelar lat/lng — desliga GPS.
  const geo = useGeolocation(!editing);

  const [form, setForm] = useState<FieldInterviewInput>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  // Quando entra em modo edição (ou troca de entrevista), carrega os campos.
  useEffect(() => {
    if (editing) {
      setForm({
        voter_name: editing.voter_name,
        voter_phone: editing.voter_phone ?? '',
        neighborhood: editing.neighborhood ?? '',
        municipality_code: editing.municipality_code ?? '',
        vote_intention: editing.vote_intention,
        receptivity_score: editing.receptivity_score,
        priority_themes: editing.priority_themes,
        vote_decided: editing.vote_decided,
        notes: editing.notes ?? '',
        lat: editing.lat,
        lng: editing.lng,
      });
    } else {
      setForm(EMPTY);
    }
  }, [editing]);

  // Pre-fill municipality from the user's profile when available (criando).
  useEffect(() => {
    if (editing) return;
    if (session?.profile.municipality_code && !form.municipality_code) {
      setForm((f) => ({ ...f, municipality_code: session.profile.municipality_code ?? '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.profile.municipality_code, editing]);

  useEffect(() => {
    if (editing) return;
    if (geo.lat != null && geo.lng != null) {
      setForm((f) => ({ ...f, lat: geo.lat, lng: geo.lng }));
    }
  }, [geo.lat, geo.lng, editing]);

  const themes = useMemo(() => PRIORITY_THEMES.slice(), []);

  function toggleTheme(theme: string) {
    setForm((f) =>
      f.priority_themes.includes(theme)
        ? { ...f, priority_themes: f.priority_themes.filter((t) => t !== theme) }
        : { ...f, priority_themes: [...f.priority_themes, theme] },
    );
  }

  function update<K extends keyof FieldInterviewInput>(
    key: K,
    value: FieldInterviewInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !session.campaign) return;
    if (!form.voter_name.trim()) {
      toast.error('Informe o nome do entrevistado.');
      return;
    }
    if (!form.municipality_code) {
      toast.error('Selecione o município.');
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        // Edição grava direto na coleção — não passa pela fila offline pois
        // a entrevista já está persistida.
        collections.interviews.update(editing.id, {
          voter_name: form.voter_name,
          voter_phone: form.voter_phone || null,
          municipality_code: form.municipality_code || null,
          neighborhood: form.neighborhood || null,
          vote_intention: form.vote_intention,
          receptivity_score: form.receptivity_score,
          priority_themes: form.priority_themes,
          vote_decided: form.vote_decided,
          notes: form.notes || null,
          lat: form.lat,
          lng: form.lng,
        });
        toast.success('Entrevista atualizada.');
        onSaved?.();
        return;
      }

      // Criando: sempre passa pela fila offline — mesma rota online/offline.
      enqueueInterview(form, session.campaign.id, session.id);
      toast.success(
        online
          ? 'Entrevista salva — será sincronizada em segundo plano.'
          : 'Entrevista salva offline. Será enviada ao reconectar.',
      );
      setForm({
        ...EMPTY,
        municipality_code: form.municipality_code,
        lat: form.lat,
        lng: form.lng,
      });
      onSaved?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-3 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">
              {geo.loading
                ? 'Obtendo localização...'
                : geo.error
                  ? 'Sem GPS — registro será salvo sem coordenadas.'
                  : geo.lat != null && geo.lng != null
                    ? `${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)} (±${Math.round(geo.accuracy ?? 0)}m)`
                    : 'Aguardando GPS...'}
            </span>
          </div>
          {geo.loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="voter_name">Nome completo</Label>
          <Input
            id="voter_name"
            value={form.voter_name}
            onChange={(e) => update('voter_name', e.target.value)}
            placeholder="Como o entrevistado se apresentou"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="voter_phone">Telefone (opcional)</Label>
          <Input
            id="voter_phone"
            inputMode="tel"
            value={form.voter_phone}
            onChange={(e) => update('voter_phone', formatPhone(e.target.value))}
            placeholder="(31) 99999-9999"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input
            id="neighborhood"
            value={form.neighborhood}
            onChange={(e) => update('neighborhood', e.target.value)}
            placeholder="Ex: Savassi"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Município</Label>
          <MunicipalityCombobox
            value={form.municipality_code}
            onChange={(code) => update('municipality_code', code)}
            placeholder="Buscar município…"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Intenção de voto</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {(Object.keys(VOTE_INTENTION_LABEL) as VoteIntention[]).map((opt) => {
            const active = form.vote_intention === opt;
            return (
              <button
                type="button"
                key={opt}
                onClick={() => update('vote_intention', opt)}
                className={
                  active
                    ? 'rounded-lg border-2 border-primary bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-colors'
                    : 'rounded-lg border border-vortex-border bg-vortex-surface/40 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }
              >
                {VOTE_INTENTION_LABEL[opt]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Receptividade</Label>
          <Badge variant="outline">{RECEPTIVITY_LABELS[form.receptivity_score - 1]}</Badge>
        </div>
        <Slider
          min={1}
          max={5}
          step={1}
          value={[form.receptivity_score]}
          onValueChange={(v) => update('receptivity_score', v[0] ?? 3)}
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Temas prioritários</Label>
        <div className="flex flex-wrap gap-2">
          {themes.map((theme) => {
            const active = form.priority_themes.includes(theme);
            return (
              <button
                type="button"
                key={theme}
                onClick={() => toggleTheme(theme)}
                className={
                  active
                    ? 'rounded-full border border-primary bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary'
                    : 'rounded-full border border-vortex-border bg-vortex-surface/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }
              >
                {theme}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-vortex-border bg-vortex-surface/40 p-3">
        <Checkbox
          id="vote_decided"
          checked={form.vote_decided}
          onCheckedChange={(checked) => update('vote_decided', checked === true)}
        />
        <Label htmlFor="vote_decided" className="cursor-pointer">
          O entrevistado já decidiu em quem votar.
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          rows={4}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Anotações livres sobre o contato, pontos de atenção, próximos passos..."
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        <Save className="h-4 w-4" />
        {submitting
          ? 'Salvando…'
          : editing
            ? 'Atualizar entrevista'
            : 'Salvar entrevista'}
      </Button>
    </form>
  );
}
