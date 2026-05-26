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
import { collections } from '@/lib/data';
import { formatPhone } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { MG_MUNICIPALITIES } from '@/data/municipalities-mg';
import type { Supporter, SupporterRoleType, SupporterStatus } from '@/types';

const ROLE_OPTIONS: { value: SupporterRoleType; label: string }[] = [
  { value: 'lider', label: 'Líder' },
  { value: 'cabo', label: 'Cabo eleitoral' },
  { value: 'militante', label: 'Militante' },
  { value: 'apoiador', label: 'Apoiador' },
];

const STATUS_OPTIONS: { value: SupporterStatus; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'inativo', label: 'Inativo' },
];

type FormState = Omit<Supporter, 'id' | 'campaign_id' | 'created_by' | 'created_at'>;

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
  role: 'militante',
  status: 'ativo',
};

interface SupporterFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Supporter | null;
}

export function SupporterFormSheet({ open, onOpenChange, editing }: SupporterFormSheetProps) {
  const session = useAuthStore((s) => s.session);
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
        status: editing.status,
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select
                value={form.role}
                onValueChange={(v) => update('role', v as SupporterRoleType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
