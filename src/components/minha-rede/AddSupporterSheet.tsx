// ============================================================================
// AddSupporterSheet — formulário pra supporter/leader cadastrar manualmente
// um novo apoiador na própria rede (/minha-rede). Também funciona em modo
// EDIÇÃO (passar `editing` como prop).
// ----------------------------------------------------------------------------
// Diferenças do SupporterFormSheet de /liderancas:
//
//  • Default role = 'apoiador' (não 'lideranca')
//  • Campo NOTES extra (migration 048)
//  • Validação de DUPLICIDADE no Submit (lib/supporterDedup.ts) — bloqueia
//    salvamento e mostra card explicando quem já cadastrou
//  • SEM botão de excluir (apoiador só pode ser removido por admin/coord)
//  • SEM ReferrerCombobox — o referrer_id é AUTOMÁTICO (id do me)
//  • SEM AddressFields completos — só município + WhatsApp (formulário enxuto)
//  • INSERT direto via supabase (não usa collections.create) pra ter o ID
//    real instantâneo — sem ID otimista
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Save, Loader2, AlertCircle } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { MunicipalityCombobox } from '@/components/ui/municipality-combobox';
import { AddressFields, type AddressValue } from '@/components/forms/AddressFields';
import { supabase } from '@/lib/supabase';
import { formatPhone } from '@/lib/utils';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { MG_MUNICIPALITIES } from '@/data/municipalities-mg';
import { checkDuplicate, type DuplicateCheckResult } from '@/lib/supporterDedup';
import { type Supporter } from '@/types';

interface AddSupporterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando preenchido, modo EDIÇÃO (UPDATE). Quando null, modo CADASTRO (INSERT). */
  editing: Supporter | null;
  /**
   * ID do supporter do usuário logado (do useMySupporter na /minha-rede).
   * Usado como `referrer_id` no INSERT — todo novo cadastro nasce como filho
   * direto do usuário que está cadastrando.
   *
   * Pode ser null em casos degenerados (ex.: usuário sem supporter — embora
   * a /minha-rede já bloqueie esse caso). Quando null, o submit é bloqueado
   * com toast de erro.
   */
  myId: string | null;
  /**
   * Callback opcional disparado depois do INSERT/UPDATE bem-sucedido. Útil
   * pra pai recarregar a lista, fechar o sheet, etc. Não é await-able —
   * use pra side effects (toast, navigate).
   */
  onSaved?: (supporter: Supporter) => void;
}

/** Máscara de CPF: 999.999.999-99 (aplicada onChange). */
function formatCpf(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Estado do formulário — sub-set dos campos de Supporter relevantes pro fluxo.
 *
 * Nota sobre `role`: NÃO faz parte do FormState porque o usuário não escolhe
 * — todo cadastro feito por esta tela vira `role='apoiador'` automaticamente
 * (hardcoded no payload). Por isso o dropdown "Função na campanha" foi
 * removido em 2026-06-08. */
interface FormState {
  name: string;
  whatsapp: string;
  municipality_code: string | null;
  cpf: string;
  email: string;
  phone: string;
  vote_potential: number | null;
  notes: string;
  // Endereço — preenchido (parcial ou totalmente) via ViaCEP pelo AddressFields.
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  neighborhood: string | null;
}

const EMPTY: FormState = {
  name: '',
  whatsapp: '',
  municipality_code: null,
  cpf: '',
  email: '',
  phone: '',
  vote_potential: null,
  notes: '',
  cep: null,
  logradouro: null,
  numero: null,
  complemento: null,
  neighborhood: null,
};

export function AddSupporterSheet({
  open,
  onOpenChange,
  editing,
  myId,
  onSaved,
}: AddSupporterSheetProps) {
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dup, setDup] = useState<DuplicateCheckResult | null>(null);

  // Pré-preencher quando entra em modo edição. Quando fecha (open=false),
  // reseta no próximo open=true (cadastro) ou no efeito acima (edição).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        whatsapp: editing.whatsapp ?? '',
        municipality_code: editing.municipality_code,
        cpf: editing.cpf ?? '',
        email: editing.email ?? '',
        phone: editing.phone ?? '',
        vote_potential: editing.vote_potential,
        notes: editing.notes ?? '',
        cep: editing.cep,
        logradouro: editing.logradouro,
        numero: editing.numero,
        complemento: editing.complemento,
        neighborhood: editing.neighborhood,
      });
    } else {
      setForm(EMPTY);
    }
    setDup(null); // limpa aviso de duplicata ao abrir/trocar modo
  }, [editing, open]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    // Sempre que o user mexe num campo relevante, invalida o aviso de
    // duplicata pra não mostrar info stale após a edição.
    if (dup) setDup(null);
  }

  // Resolve o nome da cidade pelo municipality_code — `city text` é NOT NULL
  // no banco, então sempre temos que enviar string. Pega do dataset estático.
  const cityName = useMemo(() => {
    if (!form.municipality_code) return '';
    return (
      MG_MUNICIPALITIES.find((m) => m.code === form.municipality_code)?.name ?? ''
    );
  }, [form.municipality_code]);

  function handleMunicipalityChange(code: string) {
    setForm((f) => ({ ...f, municipality_code: code || null }));
    if (dup) setDup(null);
  }

  /**
   * Recebe o AddressValue completo do AddressFields (que já tem ViaCEP
   * embutido). Faz merge com o restante do form. O AddressFields também
   * pode atualizar `city` e `municipality_code` quando o ViaCEP devolve
   * um IBGE de MG — preservamos esse comportamento.
   */
  function handleAddressChange(next: AddressValue) {
    setForm((f) => ({
      ...f,
      cep: next.cep,
      logradouro: next.logradouro,
      numero: next.numero,
      complemento: next.complemento,
      neighborhood: next.neighborhood,
      municipality_code: next.municipality_code,
    }));
    if (dup) setDup(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (checking || saving) return;

    // --- Validações de cliente ---
    if (!form.name.trim()) {
      toast.error('Informe o nome.');
      return;
    }
    if (!form.whatsapp.trim()) {
      toast.error('Informe o WhatsApp.');
      return;
    }
    if (!form.municipality_code) {
      toast.error('Selecione o município.');
      return;
    }
    if (!campaignId) {
      toast.error('Sem campanha ativa.');
      return;
    }
    if (!editing && !myId) {
      // myId só é obrigatório no INSERT (modo cadastro). Na edição não
      // precisamos dele — o referrer_id atual já está salvo.
      toast.error('Sem perfil vinculado pra registrar a indicação.');
      return;
    }

    // --- Checa duplicata (bloqueia salvamento se positivo) ---
    setChecking(true);
    const result = await checkDuplicate(supabase, campaignId, {
      name: form.name,
      whatsapp: form.whatsapp,
      phone: form.phone,
      city: cityName,
      municipalityCode: form.municipality_code,
      excludeId: editing?.id ?? null,
    });
    setChecking(false);
    if (result.isDuplicate) {
      setDup(result);
      return;
    }

    // --- Persiste ---
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        whatsapp: form.whatsapp.trim() || null,
        municipality_code: form.municipality_code,
        city: cityName, // NOT NULL no DB
        cpf: form.cpf.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        // Cadastro feito pela rede em /minha-rede SEMPRE é apoiador — o
        // usuário não escolhe o cargo. Override também em modo edição
        // (não há expectativa de mudar o role por esta tela).
        role: 'apoiador' as const,
        role_custom: null,
        vote_potential:
          form.vote_potential != null && form.vote_potential >= 0
            ? form.vote_potential
            : null,
        notes: form.notes.trim() || null,
        // Endereço — strings vazias viram null (consistência com seleção
        // opcional do banco; evita salvar " " ou "").
        cep: form.cep?.trim() || null,
        logradouro: form.logradouro?.trim() || null,
        numero: form.numero?.trim() || null,
        complemento: form.complemento?.trim() || null,
        neighborhood: form.neighborhood?.trim() || null,
      };

      if (editing) {
        const { data, error } = await supabase
          .from('supporters')
          .update(payload)
          .eq('id', editing.id)
          .select('*')
          .single();
        if (error) throw error;
        toast.success('Apoiador atualizado!');
        if (data) onSaved?.(data as Supporter);
      } else {
        // INSERT direto (não usa collections.create) pra ter ID/invite_code
        // reais. Realtime do useCollection(supporters) propaga a linha
        // automaticamente — a árvore em /minha-rede atualiza sozinha.
        const { data, error } = await supabase
          .from('supporters')
          .insert({
            ...payload,
            campaign_id: campaignId,
            referrer_id: myId, // todo novo apoiador nasce filho do user logado
            status: 'ativo',
            created_by: session!.id,
          })
          .select('*')
          .single();
        if (error) throw error;
        toast.success('Apoiador cadastrado com sucesso!');
        if (data) onSaved?.(data as Supporter);
      }
      onOpenChange(false);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[AddSupporterSheet] save falhou:', e);
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-5">
          <SheetTitle>{editing ? 'Editar apoiador' : 'Cadastrar apoiador'}</SheetTitle>
          <SheetDescription>
            {editing
              ? 'Atualize os dados do apoiador cadastrado por você.'
              : 'Cadastre uma pessoa que você está trazendo pra rede da campanha.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Aviso de duplicata — substitui o submit normal quando positivo */}
          {dup?.isDuplicate && dup.existingSupporter ? (
            <DuplicateWarningCard match={dup.existingSupporter} matchType={dup.matchType!} />
          ) : null}

          {/* ----- Obrigatórios ----- */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nome completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">
              WhatsApp <span className="text-destructive">*</span>
            </Label>
            <Input
              id="whatsapp"
              inputMode="tel"
              value={form.whatsapp}
              onChange={(e) => update('whatsapp', formatPhone(e.target.value))}
              placeholder="(31) 99999-9999"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>
              Município <span className="text-destructive">*</span>
            </Label>
            <MunicipalityCombobox
              value={form.municipality_code ?? ''}
              onChange={handleMunicipalityChange}
              placeholder="Buscar município…"
            />
          </div>

          {/* Endereço estruturado (migration 014) — CEP preenche logradouro,
              bairro e cidade automaticamente via ViaCEP. Reutiliza o mesmo
              componente do SupporterFormSheet/Eleitores. */}
          <AddressFields
            value={{
              cep: form.cep,
              logradouro: form.logradouro,
              numero: form.numero,
              complemento: form.complemento,
              neighborhood: form.neighborhood,
              city: cityName,
              municipality_code: form.municipality_code,
            }}
            onChange={handleAddressChange}
          />

          {/* ----- Opcionais ----- */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                inputMode="numeric"
                value={form.cpf}
                onChange={(e) => update('cpf', formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone alternativo</Label>
              <Input
                id="phone"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => update('phone', formatPhone(e.target.value))}
                placeholder="(31) 3333-4444"
              />
            </div>
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
                  if (raw === '') return update('vote_potential', null);
                  const n = parseInt(raw, 10);
                  update('vote_potential', Number.isFinite(n) ? Math.max(0, n) : null);
                }}
                placeholder="Ex.: 5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Detalhes úteis: contexto da indicação, disponibilidade etc."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving || checking}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              // Bloqueia salvamento enquanto está checando duplicata, salvando,
              // OU quando há aviso de duplicata pendente (user precisa mudar
              // algum campo pra invalidar o aviso e tentar de novo).
              disabled={checking || saving || dup?.isDuplicate === true}
            >
              {checking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando…
                </>
              ) : saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ----------------------------------------------------------------------------
// Card de aviso de duplicata — exibido dentro do sheet quando checkDuplicate
// retorna positivo. Substitui o submit normal: o usuário precisa mudar
// algum campo (que invalida o aviso) ou cancelar.
// ----------------------------------------------------------------------------

const MATCH_LABEL: Record<NonNullable<DuplicateCheckResult['matchType']>, string> = {
  whatsapp_exact: 'mesmo WhatsApp',
  phone_exact: 'mesmo telefone',
  name_city: 'mesmo nome e cidade',
};

function DuplicateWarningCard({
  match,
  matchType,
}: {
  match: NonNullable<DuplicateCheckResult['existingSupporter']>;
  matchType: NonNullable<DuplicateCheckResult['matchType']>;
}) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
      <div className="mb-2 flex items-center gap-2 font-medium text-amber-200">
        <AlertCircle className="h-4 w-4" />
        Apoiador já cadastrado
      </div>
      <p className="text-amber-100/90">
        <strong>"{match.name}"</strong> de <strong>{match.city}</strong> já está
        na rede da campanha (detectado por <em>{MATCH_LABEL[matchType]}</em>).
      </p>
      <div className="mt-3 space-y-0.5 text-xs text-amber-100/80">
        <p>
          Cadastrado por:{' '}
          <strong className="text-amber-100">{match.createdByName}</strong>
        </p>
        <p>Em: {new Date(match.createdAt).toLocaleString('pt-BR')}</p>
      </div>
      <p className="mt-3 text-xs text-amber-100/70">
        Se acredita que é um erro, entre em contato com o administrador da campanha.
      </p>
    </div>
  );
}
