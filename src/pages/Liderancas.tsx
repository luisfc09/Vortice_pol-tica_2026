import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Phone,
  MapPin,
  Mail,
  Users,
  Download,
  MessageCircle,
  Target,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Youtube,
  Music2,
  Globe,
  ExternalLink,
  ChevronRight,
  UsersRound,
  Share2,
  List,
  Network,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToCsv, stampedCsvName, csvDate } from '@/lib/csv-export';
import { ImportCsvButtons } from '@/components/data/ImportCsvButtons';
import { pickField, onlyDigits, normText, type ImportRowResult } from '@/lib/csv-import';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/data/SearchBar';
import { EmptyState } from '@/components/data/EmptyState';
import { ConfirmDelete } from '@/components/data/ConfirmDelete';
import { SupporterFormSheet } from '@/components/supporters/SupporterFormSheet';
import { SupporterTree } from '@/components/liderancas/SupporterTree';
import { InviteModal } from '@/components/liderancas/InviteModal';
import { ConvidarLiderancaButton } from '@/components/liderancas/ConvidarLiderancaButton';
import { OpenInMapsButton } from '@/components/maps/OpenInMapsButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { collections, useCollection } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { whatsappLink, socialUrl, cn } from '@/lib/utils';
import { indexById, indexByParent } from '@/lib/hierarchy';
import {
  SOCIAL_PLATFORM_LABEL,
  SUPPORTER_ROLE_LABEL,
  SUPPORTER_ROLE_OPTIONS,
  type SocialPlatform,
  type Supporter,
  type SupporterRoleType,
} from '@/types';

// Ícone Lucide específico por plataforma (TikTok não tem ícone próprio
// no Lucide, então usamos Music2 que sinaliza o app de vídeo).
function socialIconFor(p: SocialPlatform): LucideIcon {
  switch (p) {
    case 'instagram': return Instagram;
    case 'facebook': return Facebook;
    case 'x': return Twitter;
    case 'tiktok': return Music2;
    case 'linkedin': return Linkedin;
    case 'youtube': return Youtube;
    default: return Globe;
  }
}

// Mapa para parsear o CSV com tolerância a "Instagram", "instagram", "INSTA"
// etc. Aliases comuns que usuários costumam digitar.
const SOCIAL_PLATFORM_BY_TEXT: Record<string, SocialPlatform> = {
  instagram: 'instagram',
  insta: 'instagram',
  ig: 'instagram',
  facebook: 'facebook',
  fb: 'facebook',
  x: 'x',
  twitter: 'x',
  tweet: 'x',
  tiktok: 'tiktok',
  tt: 'tiktok',
  linkedin: 'linkedin',
  li: 'linkedin',
  youtube: 'youtube',
  yt: 'youtube',
  outro: 'outro',
  outra: 'outro',
  other: 'outro',
};

function parseSocialPlatform(raw: string): SocialPlatform | null {
  const k = normText(raw);
  return SOCIAL_PLATFORM_BY_TEXT[k] ?? null;
}

type RoleFilter = 'all' | SupporterRoleType;

// Variante do badge por categoria de papel (visual).
function badgeVariantFor(r: SupporterRoleType): 'default' | 'secondary' | 'outline' | 'warning' {
  if (r === 'candidato' || r === 'administrador') return 'default';
  if (r.startsWith('coord_')) return 'secondary';
  if (
    r === 'prefeito' ||
    r === 'vice_prefeito' ||
    r === 'vereador' ||
    r === 'chefe_gabinete' ||
    r === 'assessor_gabinete' ||
    r === 'secretario' ||
    r === 'procurador'
  ) {
    return 'warning';
  }
  return 'outline';
}

// Label que mostra o cargo do supporter — se for "outro", devolve o
// texto custom em vez do label genérico.
function displayRole(s: Supporter): string {
  if (s.role === 'outro' && s.role_custom && s.role_custom.trim()) {
    return s.role_custom;
  }
  return SUPPORTER_ROLE_LABEL[s.role] ?? s.role;
}

export default function LiderancasPage() {
  const session = useAuthStore((s) => s.session);
  const supporters = useCollection(collections.supporters);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [editing, setEditing] = useState<Supporter | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supporter | null>(null);
  // Convite: liderança alvo do InviteModal (WhatsApp/SMS/E-mail/Copiar link).
  // Migration 049 — link reutilizável: qualquer supporter com invite_code
  // válido pode abrir o modal (não há mais estado "consumido"). O botão no
  // card já filtra por s.invite_code.
  const [inviteTarget, setInviteTarget] = useState<Supporter | null>(null);
  // Migration 046 — H5: alternância entre lista (cards) e rede (árvore).
  const [viewMode, setViewMode] = useState<'lista' | 'rede'>('lista');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return supporters.filter((s) => {
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;
      if (!q) return true;
      const haystack = `${s.name} ${s.city} ${s.neighborhood ?? ''} ${s.phone ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [supporters, query, roleFilter]);

  const countByRole = useMemo(() => {
    const m = new Map<SupporterRoleType, number>();
    for (const s of supporters) m.set(s.role, (m.get(s.role) ?? 0) + 1);
    return m;
  }, [supporters]);

  // Migration 046 — índices da hierarquia, memoizados.
  //   • supportersById: pra resolver referrer.name em O(1) no card
  //   • childrenByParent: pra contar "N indicações" em O(1)
  const supportersById = useMemo(() => indexById(supporters), [supporters]);
  const childrenByParent = useMemo(() => indexByParent(supporters), [supporters]);

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(s: Supporter) {
    setEditing(s);
    setSheetOpen(true);
  }
  function openReferrer(referrerId: string) {
    const r = supportersById.get(referrerId);
    if (r) openEdit(r);
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    collections.supporters.remove(deleteTarget.id);
  }
  const canManage = session?.role === 'admin' || session?.role === 'coordinator';

  const STATUS_LABEL: Record<string, string> = {
    ativo: 'Ativo',
    pendente: 'Pendente',
    inativo: 'Inativo',
  };

  function exportCsv() {
    exportToCsv(stampedCsvName('liderancas'), filtered, [
      { header: 'Nome', value: (s) => s.name },
      { header: 'Papel', value: (s) => displayRole(s) },
      { header: 'Telefone', value: (s) => s.phone },
      { header: 'WhatsApp', value: (s) => s.whatsapp },
      { header: 'Email', value: (s) => s.email },
      { header: 'CPF', value: (s) => s.cpf },
      { header: 'Cidade', value: (s) => s.city },
      { header: 'Bairro', value: (s) => s.neighborhood },
      { header: 'CEP', value: (s) => s.cep },
      { header: 'Logradouro', value: (s) => s.logradouro },
      { header: 'Número', value: (s) => s.numero },
      { header: 'Potencial de Votos', value: (s) => s.vote_potential },
      {
        header: 'Rede Social',
        value: (s) => (s.social_platform ? SOCIAL_PLATFORM_LABEL[s.social_platform] : null),
      },
      { header: 'Rede Social Usuário', value: (s) => s.social_handle },
      {
        header: 'Indicado Por',
        value: (s) => (s.referrer_id ? supportersById.get(s.referrer_id)?.name ?? null : null),
      },
      { header: 'Status', value: (s) => STATUS_LABEL[s.status] ?? s.status },
      { header: 'Cadastrado em', value: (s) => csvDate(s.created_at) },
    ]);
  }

  // Valida + classifica cada linha do CSV (erro/duplicado/aviso/válido) antes de gravar.
  function validateSupporterRows(rows: Record<string, string>[]): ImportRowResult[] {
    const existNamePhone = new Set<string>();
    const existNameCity = new Set<string>();
    for (const s of supporters) {
      const n = normText(s.name);
      if (s.phone) existNamePhone.add(`${n}|${onlyDigits(s.phone)}`);
      existNameCity.add(`${n}|${normText(s.city ?? '')}`);
    }
    const seenNamePhone = new Set<string>();
    const seenNameCity = new Set<string>();

    // Migration 046 — set de nomes elegíveis pra "Indicado Por":
    //   • supporters já cadastrados no banco
    //   • OUTRAS linhas do MESMO CSV (vão ser inseridas no PASS 1
    //     antes do PASS 2 de vinculação)
    const namesPool = new Set<string>();
    for (const s of supporters) namesPool.add(normText(s.name));
    for (const r of rows) {
      const n = pickField(r, 'Nome', 'name').trim();
      if (n) namesPool.add(normText(n));
    }

    return rows.map((r, i): ImportRowResult => {
      const line = i + 1;
      const name = pickField(r, 'Nome', 'name').trim();
      const phone = pickField(r, 'Telefone', 'phone', 'celular').trim();
      const cidade = pickField(r, 'Cidade', 'city').trim();
      const papel = pickField(r, 'Papel', 'cargo', 'role').trim();
      // Campos novos (migration 045) — só validamos formato; importação
      // segue mesmo se vierem inválidos (substituímos por null).
      const potencialRaw = pickField(r, 'Potencial de Votos', 'potencial', 'vote_potential').trim();
      const redeRaw = pickField(r, 'Rede Social', 'rede social', 'social_platform').trim();
      // Migration 046 — referência hierárquica (nome do indicador)
      const indicadoRaw = pickField(r, 'Indicado Por', 'indicado por', 'indicado_por', 'referrer', 'indicador').trim();
      const secondary = [cidade, papel, phone].filter(Boolean).join(' · ') || undefined;

      // ERRO — não importa
      if (name.length < 2)
        return {
          line,
          raw: r,
          status: 'error',
          primary: name,
          secondary,
          message: 'Nome vazio ou com menos de 2 caracteres',
        };

      // DUPLICADO — não importa
      const nKey = normText(name);
      if (phone) {
        const key = `${nKey}|${onlyDigits(phone)}`;
        if (existNamePhone.has(key) || seenNamePhone.has(key))
          return {
            line,
            raw: r,
            status: 'duplicate',
            primary: name,
            secondary,
            message: 'Nome + telefone já cadastrado',
          };
        seenNamePhone.add(key);
      } else {
        const key = `${nKey}|${normText(cidade)}`;
        if (existNameCity.has(key) || seenNameCity.has(key))
          return {
            line,
            raw: r,
            status: 'duplicate',
            primary: name,
            secondary,
            message: 'Nome + cidade já cadastrado (sem telefone)',
          };
        seenNameCity.add(key);
      }

      // AVISOS — importa mesmo assim, só sinaliza no preview
      const warnings: string[] = [];
      if (!phone) warnings.push('Sem telefone');
      if (potencialRaw && !/^\d+$/.test(potencialRaw))
        warnings.push(`Potencial "${potencialRaw}" não é número inteiro — será ignorado`);
      if (redeRaw && !parseSocialPlatform(redeRaw))
        warnings.push(`Rede social "${redeRaw}" não reconhecida — será ignorada`);
      if (indicadoRaw) {
        if (normText(indicadoRaw) === normText(name)) {
          warnings.push('Indicador é a própria liderança — vínculo ignorado');
        } else if (!namesPool.has(normText(indicadoRaw))) {
          warnings.push(`Indicador "${indicadoRaw}" não encontrado — será importada sem vínculo`);
        }
      }

      if (warnings.length > 0)
        return {
          line, raw: r, status: 'warning', primary: name, secondary,
          message: warnings.join(' · '),
        };

      return { line, raw: r, status: 'valid', primary: name, secondary };
    });
  }

  async function importSupporters(rows: Record<string, string>[]) {
    if (!session?.campaign) return { ok: 0 };
    const campaignId = session.campaign.id;
    const createdBy = session.id;

    // Throttle: 50 ms entre inserts quando o CSV é grande (>100 linhas).
    // Evita timeout/rate-limit do Supabase em imports massivos.
    const useThrottle = rows.length > 100;
    const throttleMs = 50;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    // ----------------------------------------------------------------
    // PASS 1 — INSERT de todas as linhas SEM referrer_id.
    //
    // Usamos `supabase.from('supporters').insert(...).select('id, name').single()`
    // direto (em vez do `collections.supporters.create` que devolve um
    // tempUuid otimista) porque o PASS 2 precisa do ID REAL retornado
    // pelo banco pra fazer o UPDATE de referrer_id.
    //
    // Linha-a-linha pra capturar o ID real de cada uma na ordem do CSV.
    // Para imports grandes (>500), pode evoluir pra batch INSERT + RETURNING
    // mantendo a ordem.
    // ----------------------------------------------------------------
    const insertedByRowIndex: ({ id: string; name: string } | null)[] = [];
    let ok = 0;

    for (const r of rows) {
      const name = pickField(r, 'Nome', 'name');
      // Migration 045 — parse tolerante dos campos opcionais
      const potencialRaw = pickField(r, 'Potencial de Votos', 'potencial', 'vote_potential').trim();
      const potencialNum = /^\d+$/.test(potencialRaw) ? parseInt(potencialRaw, 10) : null;
      const redeRaw = pickField(r, 'Rede Social', 'rede social', 'social_platform').trim();
      const platform = redeRaw ? parseSocialPlatform(redeRaw) : null;
      const handleRaw = pickField(r, 'Rede Social Usuário', 'rede social usuario', 'social_handle', 'social user').trim();

      const payload = {
        campaign_id: campaignId,
        created_by: createdBy,
        name,
        cpf: pickField(r, 'CPF', 'cpf') || null,
        phone: pickField(r, 'Telefone', 'phone', 'celular') || null,
        email: pickField(r, 'Email', 'e-mail') || null,
        city: pickField(r, 'Cidade', 'city') || null,
        neighborhood: pickField(r, 'Bairro', 'neighborhood') || null,
        municipality_code: null,
        cep: null,
        logradouro: null,
        numero: null,
        complemento: null,
        role: 'outro' as const,
        role_custom: pickField(r, 'Papel', 'cargo', 'role') || null,
        status: 'ativo' as const,
        vote_potential: potencialNum != null && potencialNum >= 0 ? potencialNum : null,
        whatsapp: pickField(r, 'WhatsApp', 'whatsapp', 'zap') || null,
        social_platform: platform,
        social_handle: platform ? handleRaw || null : null,
        // referrer_id intencionalmente OMITIDO neste pass — vai ser
        // resolvido no PASS 2 abaixo.
        referrer_id: null,
        invite_used_at: null,
      };

      const { data, error } = await supabase
        .from('supporters')
        .insert(payload)
        .select('id, name')
        .single();
      if (error) {
        console.warn('[liderancas import] PASS 1 falhou:', error.message);
        insertedByRowIndex.push(null);
        continue;
      }
      insertedByRowIndex.push({ id: data.id as string, name: data.name as string });
      ok++;
      if (useThrottle) await sleep(throttleMs);
    }

    // ----------------------------------------------------------------
    // PASS 2 — UPDATE referrer_id nas linhas que têm "Indicado Por".
    //
    // Ordem de busca do nome (case/accent-insensitive):
    //   1) recém-inseridos do PASS 1 (mais provável de ser o caso quando
    //      o usuário coloca hierarquia interna ao próprio CSV)
    //   2) supporters já existentes no snapshot da campanha
    //
    // Se não encontrar: ignora silenciosamente (warning já foi
    // mostrado no preview pelo validateSupporterRows).
    // Se for self-reference (indicador = própria linha): ignora.
    // ----------------------------------------------------------------
    const nameToId = new Map<string, string>();
    // 2º na ordem = supporters já existentes (sobrescritos pelos novos abaixo)
    for (const s of supporters) nameToId.set(normText(s.name), s.id);
    // 1º na ordem (maior prioridade) = recém-inseridos
    for (const ins of insertedByRowIndex) {
      if (ins) nameToId.set(normText(ins.name), ins.id);
    }

    let linked = 0;        // quantas vincularam com sucesso no PASS 2
    let noLinkAttempt = 0; // quantas tentaram vincular mas falharam (não achou nome ou self)

    for (let i = 0; i < rows.length; i++) {
      const ins = insertedByRowIndex[i];
      if (!ins) continue;
      const indicadoRaw = pickField(rows[i], 'Indicado Por', 'indicado por', 'indicado_por', 'referrer', 'indicador').trim();
      if (!indicadoRaw) continue;          // não tentou vincular — não conta
      const referrerKey = normText(indicadoRaw);
      const referrerId = nameToId.get(referrerKey);
      if (!referrerId || referrerId === ins.id) {
        noLinkAttempt++;                   // tentou vincular mas não rolou
        continue;
      }

      const { error: updErr } = await supabase
        .from('supporters')
        .update({ referrer_id: referrerId })
        .eq('id', ins.id);
      if (updErr) {
        console.warn(`[liderancas import] PASS 2 falhou em "${ins.name}":`, updErr.message);
        noLinkAttempt++;
      } else {
        linked++;
      }
    }

    // Toast detalhado da hierarquia (separado do toast genérico do
    // ImportCsvButtons que mostra erros/duplicados/total).
    toast.info(
      `${ok} importada${ok === 1 ? '' : 's'} · ${linked} vinculada${linked === 1 ? '' : 's'}${noLinkAttempt > 0 ? ` · ${noLinkAttempt} sem vínculo` : ''}`,
    );

    return { ok };
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {supporters.length} {supporters.length === 1 ? 'liderança cadastrada' : 'lideranças cadastradas'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ImportCsvButtons
            templateName="modelo-liderancas"
            templateRow={{
              Nome: 'Maria Souza',
              Telefone: '(31) 99999-0000',
              WhatsApp: '(31) 99999-0000',
              Email: 'maria@exemplo.com',
              Cidade: 'Belo Horizonte',
              Bairro: 'Savassi',
              Papel: 'Liderança comunitária',
              'Potencial de Votos': '50',
              'Rede Social': 'Instagram',
              'Rede Social Usuário': '@mariasouza',
              // Migration 046 — coluna opcional. Use o NOME EXATO (case-insensitive)
              // de uma liderança que já está na planilha OU já cadastrada no sistema.
              // Se o nome não for encontrado, a liderança é importada sem vínculo
              // e o aviso aparece no preview.
              'Indicado Por': 'Roberto Carneiro',
            }}
            templateColumns={[
              { header: 'Nome', value: (r) => r.Nome },
              { header: 'Telefone', value: (r) => r.Telefone },
              { header: 'WhatsApp', value: (r) => r.WhatsApp },
              { header: 'Email', value: (r) => r.Email },
              { header: 'Cidade', value: (r) => r.Cidade },
              { header: 'Bairro', value: (r) => r.Bairro },
              { header: 'Papel', value: (r) => r.Papel },
              { header: 'Potencial de Votos', value: (r) => r['Potencial de Votos'] },
              { header: 'Rede Social', value: (r) => r['Rede Social'] },
              { header: 'Rede Social Usuário', value: (r) => r['Rede Social Usuário'] },
              { header: 'Indicado Por', value: (r) => r['Indicado Por'] },
            ]}
            validateRows={validateSupporterRows}
            onImport={importSupporters}
            entityLabel="lideranças"
          />
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          {/* Convidar Liderança — botão outline, mesmo nível visual das outras
              ações. Renderiza null para roles sem permissão (researcher,
              supporter, leader, field_agent). */}
          <ConvidarLiderancaButton />
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Nova liderança
          </Button>
        </div>
      </div>

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Buscar por nome, cidade, bairro ou telefone"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={roleFilter}
          onValueChange={(v) => setRoleFilter(v as RoleFilter)}
        >
          <SelectTrigger className="h-9 w-full sm:w-72">
            <SelectValue placeholder="Filtrar por papel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              Todos os papéis ({supporters.length})
            </SelectItem>
            {SUPPORTER_ROLE_OPTIONS.map((r) => {
              const c = countByRole.get(r) ?? 0;
              if (c === 0 && roleFilter !== r) return null;
              return (
                <SelectItem key={r} value={r}>
                  {SUPPORTER_ROLE_LABEL[r]} ({c})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Toggle Lista / Rede (H5) — segmented control */}
        <div className="ml-auto inline-flex items-center gap-1 rounded-md border border-vortex-border bg-vortex-surface/40 p-1">
          <button
            type="button"
            onClick={() => setViewMode('lista')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
              viewMode === 'lista'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={viewMode === 'lista'}
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            type="button"
            onClick={() => setViewMode('rede')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
              viewMode === 'rede'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={viewMode === 'rede'}
          >
            <Network className="h-3.5 w-3.5" />
            Rede
          </button>
        </div>
      </div>

      {viewMode === 'rede' ? (
        supporters.length === 0 ? (
          <EmptyState
            title="Nenhuma liderança cadastrada"
            description="Adicione lideranças para começar a montar a rede."
            icon={<Users className="h-5 w-5" />}
            action={
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            }
          />
        ) : (
          <SupporterTree supporters={supporters} onOpen={openEdit} />
        )
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma liderança encontrada"
          description="Cadastre líderes, cabos e militantes para começar a montar sua base."
          icon={<Users className="h-5 w-5" />}
          action={
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground" title={s.name}>
                    {s.name}
                  </p>
                  <p
                    className="truncate text-xs text-muted-foreground"
                    title={`${s.city}${s.neighborhood ? ` · ${s.neighborhood}` : ''}`}
                  >
                    {s.city}
                    {s.neighborhood ? ` · ${s.neighborhood}` : ''}
                  </p>
                </div>
                <Badge variant={badgeVariantFor(s.role)}>{displayRole(s)}</Badge>
              </div>

              <div className="space-y-1.5 text-sm">
                {s.phone ? (
                  <p className="flex items-center gap-2 text-foreground/80">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <a href={`tel:${s.phone}`} className="hover:text-primary">
                      {s.phone}
                    </a>
                  </p>
                ) : null}
                {s.whatsapp ? (
                  <p className="flex items-center gap-2 text-foreground/80">
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
                    {(() => {
                      const link = whatsappLink(s.whatsapp);
                      return link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-emerald-300"
                          title="Abrir WhatsApp"
                        >
                          {s.whatsapp}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      ) : (
                        <span>{s.whatsapp}</span>
                      );
                    })()}
                  </p>
                ) : null}
                {s.email ? (
                  <p className="flex items-center gap-2 text-foreground/80">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate" title={s.email}>{s.email}</span>
                  </p>
                ) : null}
                {s.social_platform && s.social_handle ? (
                  (() => {
                    const Icon = socialIconFor(s.social_platform);
                    const url = socialUrl(s.social_platform, s.social_handle);
                    const label = SOCIAL_PLATFORM_LABEL[s.social_platform];
                    return (
                      <p className="flex items-center gap-2 text-foreground/80">
                        <Icon className="h-3.5 w-3.5 text-vortex-violet" />
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 truncate hover:text-vortex-violet"
                            title={`Abrir perfil em ${label}`}
                          >
                            <span className="truncate">
                              {label}: {s.social_handle}
                            </span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                          </a>
                        ) : (
                          <span className="truncate" title={`${label}: ${s.social_handle}`}>
                            {label}: {s.social_handle}
                          </span>
                        )}
                      </p>
                    );
                  })()
                ) : null}
                {/* Migration 046 — chip "Indicado por" (discreto, clicável) */}
                {s.referrer_id ? (
                  (() => {
                    const ref = supportersById.get(s.referrer_id);
                    if (!ref) return null;
                    return (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <ChevronRight className="h-3.5 w-3.5" />
                        <span>Indicado por </span>
                        <button
                          type="button"
                          onClick={() => openReferrer(s.referrer_id!)}
                          className="truncate font-medium text-foreground/90 hover:text-primary"
                          title={`Abrir ficha de ${ref.name}`}
                        >
                          {ref.name}
                        </button>
                      </p>
                    );
                  })()
                ) : null}
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>
                    Status: {s.status === 'ativo' ? 'Ativo' : s.status === 'pendente' ? 'Pendente' : 'Inativo'}
                  </span>
                </p>
              </div>

              {/* Chips — Potencial (vote_potential > 0) e/ou Indicações (N filhos > 0).
                  Mesma linha horizontal pra economizar espaço; quebra se faltar largura. */}
              {(() => {
                const childrenCount = (childrenByParent.get(s.id) ?? []).length;
                const hasPotencial = s.vote_potential != null && s.vote_potential > 0;
                if (!hasPotencial && childrenCount === 0) return null;
                return (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {hasPotencial ? (
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-vortex-violet/40 bg-vortex-violet/15 px-2.5 py-1 text-[11px] font-medium text-vortex-violet">
                        <Target className="h-3 w-3" />
                        Potencial: {s.vote_potential!.toLocaleString('pt-BR')} voto{s.vote_potential === 1 ? '' : 's'}
                      </div>
                    ) : null}
                    {childrenCount > 0 ? (
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-medium text-sky-300">
                        <UsersRound className="h-3 w-3" />
                        {childrenCount} indicaç{childrenCount === 1 ? 'ão' : 'ões'}
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-vortex-border pt-3">
                <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <OpenInMapsButton
                  target={{
                    logradouro: s.logradouro,
                    numero: s.numero,
                    bairro: s.neighborhood,
                    cidade: s.city,
                    uf: 'MG',
                    cep: s.cep,
                  }}
                />
                {/* Migration 049 — link reutilizável: o botão "Convidar"
                    aparece sempre que houver invite_code (não há mais
                    "consumido"). Só esconde no caso defensivo de code
                    ausente (registros legados anteriores à migration 046). */}
                {s.invite_code ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInviteTarget(s)}
                    className="text-vortex-lime hover:text-vortex-lime"
                  >
                    <Share2 className="h-3.5 w-3.5" /> Convidar
                  </Button>
                ) : null}
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(s)}
                    className="text-red-300 hover:text-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <SupporterFormSheet open={sheetOpen} onOpenChange={setSheetOpen} editing={editing} />
      {/* Migration 046 — H6: quando o alvo tem filhos diretos, mostrar aviso
          explícito de que eles perderão o vínculo hierárquico (referrer_id vira
          null por causa do ON DELETE SET NULL da migration). */}
      {(() => {
        const target = deleteTarget;
        const childrenCount = target ? (childrenByParent.get(target.id) ?? []).length : 0;
        const hasChildren = childrenCount > 0;
        const title = hasChildren
          ? `⚠️ Esta liderança indicou ${childrenCount} outra${childrenCount === 1 ? '' : 's'}`
          : 'Excluir liderança?';
        const description = hasChildren
          ? `Ao excluir ${target?.name ?? ''}, ${childrenCount === 1 ? 'essa liderança perderá' : `essas ${childrenCount} lideranças perderão`} o vínculo hierárquico e ${childrenCount === 1 ? 'passará a ser raiz independente' : 'passarão a ser raízes independentes'} na rede. Esta ação não pode ser desfeita.`
          : `Remover ${target?.name ?? ''} da base. Essa ação não pode ser desfeita.`;
        const confirmLabel = hasChildren ? 'Excluir mesmo assim' : 'Excluir';
        return (
          <ConfirmDelete
            open={target !== null}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            onConfirm={confirmDelete}
          />
        );
      })()}

      {/* Modal de convite (Migration 047 — auto-cadastro via /convite/[code]).
          Aberto pelo botão "Convidar" no card. Permanece montado para
          animar fade-out limpo quando inviteTarget volta a null. */}
      <InviteModal
        open={inviteTarget !== null}
        onClose={() => setInviteTarget(null)}
        supporter={
          inviteTarget && inviteTarget.invite_code
            ? { name: inviteTarget.name, invite_code: inviteTarget.invite_code }
            : null
        }
      />

    </div>
  );
}
