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
import { ReferrerCombobox } from '@/components/supporters/ReferrerCombobox';
import { collections, useCollection } from '@/lib/data';
import { formatPhone } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { MG_MUNICIPALITIES } from '@/data/municipalities-mg';
import {
  SOCIAL_PLATFORM_LABEL,
  SOCIAL_PLATFORM_OPTIONS,
  SUPPORTER_ROLE_LABEL,
  SUPPORTER_ROLE_OPTIONS,
  type SocialPlatform,
  type Supporter,
  type SupporterRoleType,
  type SupporterStatus,
} from '@/types';

const STATUS_OPTIONS: { value: SupporterStatus; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'inativo', label: 'Inativo' },
];

// invite_code é OMITIDO do form: gerado pelo banco via default (migration 046).
// referrer_id está presente — UI dele vem no H2 (combobox "Indicado por").
type FormState = Omit<
  Supporter,
  'id' | 'campaign_id' | 'created_by' | 'created_at' | 'invite_code'
>;

const EMPTY: FormState = {
  name: '',
  cpf: null,
  phone: '',
  email: '',
  city: null,
  neighborhood: null,
  municipality_code: null,
  cep: null,
  logradouro: null,
  numero: null,
  complemento: null,
  role: 'lideranca',
  role_custom: null,
  status: 'ativo',
  // Campos novos (migration 045)
  vote_potential: null,
  whatsapp: null,
  social_platform: null,
  social_handle: null,
  // Hierarquia (migration 046 — Fase 1). Combobox vem no Passo H2;
  // por enquanto novas lideranças nascem como raiz (sem indicador).
  referrer_id: null,
  // Migration 047 — convite ativo (nunca usado).
  invite_used_at: null,
  // Migration 048 — campo livre de observações.
  notes: null,
};

interface SupporterFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Supporter | null;
}

export function SupporterFormSheet({ open, onOpenChange, editing }: SupporterFormSheetProps) {
  const session = useAuthStore((s) => s.session);
  // Carrega TODOS os supporters da campanha pra alimentar o ReferrerCombobox.
  // useCollection já é scoped por campanha (RLS + filtro frontend).
  const supporters = useCollection(collections.supporters);
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        cpf: editing.cpf,
        phone: editing.phone ?? '',
        email: editing.email ?? '',
        city: editing.city,
        neighborhood: editing.neighborhood,
        municipality_code: editing.municipality_code,
        cep: editing.cep,
        logradouro: editing.logradouro,
        numero: editing.numero,
        complemento: editing.complemento,
        role: editing.role,
        role_custom: editing.role_custom,
        status: editing.status,
        vote_potential: editing.vote_potential,
        whatsapp: editing.whatsapp,
        social_platform: editing.social_platform,
        social_handle: editing.social_handle,
        referrer_id: editing.referrer_id,
        invite_used_at: editing.invite_used_at,
        notes: editing.notes,
      });
    } else if (open) {
      setForm(EMPTY);
    }
  }, [editing, open]);

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

  function onSubmit(e: React.FormEvent) {
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

    // city = nome do município (deriva do código IBGE) — preserva o campo legado.
    const muniName = MG_MUNICIPALITIES.find((m) => m.code === form.municipality_code)?.name;
    // Quando o usuário escolhe 'outro', exige o texto livre.
    if (form.role === 'outro' && !form.role_custom?.trim()) {
      toast.error('Especifique o papel personalizado.');
      return;
    }
    const payload = {
      ...form,
      phone: form.phone || null,
      email: form.email || null,
      city: muniName ?? form.city ?? null,
      neighborhood: form.neighborhood?.trim() || null,
      cep: form.cep?.trim() || null,
      logradouro: form.logradouro?.trim() || null,
      numero: form.numero?.trim() || null,
      complemento: form.complemento?.trim() || null,
      role_custom: form.role === 'outro' ? form.role_custom?.trim() || null : null,
      // Novos campos (migration 045) — normalização
      vote_potential:
        form.vote_potential != null && form.vote_potential >= 0
          ? form.vote_potential
          : null,
      whatsapp: form.whatsapp?.trim() || null,
      // Se não há plataforma selecionada, zera também o handle pra evitar
      // dados órfãos no banco.
      social_platform: form.social_platform,
      social_handle: form.social_platform
        ? form.social_handle?.trim() || null
        : null,
    };

    if (editing) {
      collections.supporters.update(editing.id, payload);
      toast.success('Liderança atualizada.');
    } else {
      collections.supporters.create({
        data: {
          ...payload,
          campaign_id: session.campaign.id,
          created_by: session.id,
        },
      });
      toast.success('Liderança cadastrada.');
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-5">
          <SheetTitle>{editing ? 'Editar liderança' : 'Nova liderança'}</SheetTitle>
          <SheetDescription>
            Cadastre líderes, cabos eleitorais, militantes e apoiadores estruturados da
            campanha.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select
                value={form.role}
                onValueChange={(v) => {
                  const next = v as SupporterRoleType;
                  setForm((f) => ({
                    ...f,
                    role: next,
                    // Limpa role_custom se sair de 'outro'
                    role_custom: next === 'outro' ? f.role_custom : null,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTER_ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {SUPPORTER_ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.role === 'outro' ? (
                <Input
                  placeholder="Especifique o cargo / papel"
                  value={form.role_custom ?? ''}
                  onChange={(e) => update('role_custom', e.target.value)}
                  required
                />
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => update('status', v as SupporterStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ''}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>
          </div>

          {/* Migration 045 — campos extras de captação */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="vote_potential">Potencial de votos</Label>
              <Input
                id="vote_potential"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.vote_potential ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    update('vote_potential', null);
                    return;
                  }
                  const n = parseInt(raw, 10);
                  update('vote_potential', Number.isFinite(n) ? Math.max(0, n) : null);
                }}
                placeholder="Ex.: 50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                inputMode="tel"
                value={form.whatsapp ?? ''}
                onChange={(e) => update('whatsapp', formatPhone(e.target.value))}
                placeholder="(31) 99999-9999"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Rede social</Label>
              <Select
                value={form.social_platform ?? ''}
                onValueChange={(v) =>
                  update('social_platform', (v || null) as SocialPlatform | null)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Plataforma…" />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORM_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {SOCIAL_PLATFORM_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="social_handle">@usuário ou link</Label>
              <Input
                id="social_handle"
                value={form.social_handle ?? ''}
                onChange={(e) => update('social_handle', e.target.value)}
                placeholder="@usuario ou https://..."
                disabled={!form.social_platform}
              />
            </div>
          </div>

          {/* Hierarquia (migration 046 — Fase 1) */}
          <div className="space-y-2">
            <Label>Indicado por</Label>
            <ReferrerCombobox
              value={form.referrer_id}
              onChange={(id) => update('referrer_id', id)}
              supporters={supporters}
              currentId={editing?.id ?? null}
              placeholder="Buscar liderança que indicou…"
            />
            <p className="text-[11px] text-muted-foreground">
              Opcional. Use para registrar quem trouxe esta liderança para a campanha.
              Lideranças descendentes da atual não aparecem (evita ciclo).
            </p>
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
