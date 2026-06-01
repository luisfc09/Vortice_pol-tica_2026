import { useMemo, useState } from 'react';
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
import { OpenInMapsButton } from '@/components/maps/OpenInMapsButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { collections, useCollection } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';
import { whatsappLink, socialUrl } from '@/lib/utils';
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

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(s: Supporter) {
    setEditing(s);
    setSheetOpen(true);
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
    let ok = 0;
    for (const r of rows) {
      const name = pickField(r, 'Nome', 'name');
      // Migration 045 — parse tolerante dos campos opcionais
      const potencialRaw = pickField(r, 'Potencial de Votos', 'potencial', 'vote_potential').trim();
      const potencialNum = /^\d+$/.test(potencialRaw) ? parseInt(potencialRaw, 10) : null;
      const redeRaw = pickField(r, 'Rede Social', 'rede social', 'social_platform').trim();
      const platform = redeRaw ? parseSocialPlatform(redeRaw) : null;
      const handleRaw = pickField(r, 'Rede Social Usuário', 'rede social usuario', 'social_handle', 'social user').trim();

      await collections.supporters.create({
        data: {
          campaign_id: session.campaign.id,
          created_by: session.id,
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
          role: 'outro',
          role_custom: pickField(r, 'Papel', 'cargo', 'role') || null,
          status: 'ativo',
          // Migration 045 — agora carrega do CSV quando presente
          vote_potential: potencialNum != null && potencialNum >= 0 ? potencialNum : null,
          whatsapp: pickField(r, 'WhatsApp', 'whatsapp', 'zap') || null,
          social_platform: platform,
          social_handle: platform ? handleRaw || null : null,
        },
      });
      ok++;
    }
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
            ]}
            validateRows={validateSupporterRows}
            onImport={importSupporters}
            entityLabel="lideranças"
          />
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
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
      </div>

      {filtered.length === 0 ? (
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
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>
                    Status: {s.status === 'ativo' ? 'Ativo' : s.status === 'pendente' ? 'Pendente' : 'Inativo'}
                  </span>
                </p>
              </div>

              {/* Chip de potencial de votos — só renderiza se > 0 */}
              {s.vote_potential != null && s.vote_potential > 0 ? (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-vortex-violet/40 bg-vortex-violet/15 px-2.5 py-1 text-[11px] font-medium text-vortex-violet">
                  <Target className="h-3 w-3" />
                  Potencial: {s.vote_potential.toLocaleString('pt-BR')} voto{s.vote_potential === 1 ? '' : 's'}
                </div>
              ) : null}

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
      <ConfirmDelete
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir liderança?"
        description={`Remover ${deleteTarget?.name ?? ''} da base. Essa ação não pode ser desfeita.`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
