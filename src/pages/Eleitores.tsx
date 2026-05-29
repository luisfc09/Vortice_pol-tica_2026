import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Phone, MapPin, UserCheck, Download, LocateFixed, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { exportToCsv, stampedCsvName, csvDate } from '@/lib/csv-export';
import { ImportCsvButtons } from '@/components/data/ImportCsvButtons';
import { pickField, onlyDigits, isValidCep, type ImportRowResult } from '@/lib/csv-import';
import { geocodeAddress } from '@/lib/geocode';
import { MG_MUNICIPALITIES } from '@/data/municipalities-mg';
import { MunicipalityCombobox } from '@/components/ui/municipality-combobox';
import { SearchBar } from '@/components/data/SearchBar';
import { FilterPill } from '@/components/data/FilterPill';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/data/EmptyState';
import { ConfirmDelete } from '@/components/data/ConfirmDelete';
import { VoterFormSheet } from '@/components/voters/VoterFormSheet';
import { OpenInMapsButton } from '@/components/maps/OpenInMapsButton';
import { collections, useCollection } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';
import {
  AGE_RANGE_LABEL,
  VOTE_INTENTION_COLOR,
  VOTE_INTENTION_LABEL,
  type AgeRange,
  type Voter,
  type VoteIntention,
} from '@/types';

type IntentionFilter = 'all' | VoteIntention;

// --- helpers de import (tolerantes a acento/caixa/label) ---
const normTxt = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const INTENTION_BY_TEXT: Record<string, VoteIntention> = (() => {
  const m: Record<string, VoteIntention> = {};
  (Object.keys(VOTE_INTENTION_LABEL) as VoteIntention[]).forEach((k) => {
    m[normTxt(k)] = k;
    m[normTxt(VOTE_INTENTION_LABEL[k])] = k;
  });
  return m;
})();
const parseIntention = (raw: string): VoteIntention => INTENTION_BY_TEXT[normTxt(raw)] ?? 'indeciso';

const AGE_BY_TEXT: Record<string, AgeRange> = (() => {
  const m: Record<string, AgeRange> = {};
  (Object.keys(AGE_RANGE_LABEL) as AgeRange[]).forEach((k) => {
    m[normTxt(k)] = k;
    m[normTxt(AGE_RANGE_LABEL[k])] = k;
  });
  return m;
})();
const parseAge = (raw: string): AgeRange | null => (raw ? AGE_BY_TEXT[normTxt(raw)] ?? null : null);

const MUNI_BY_NAME = (() => {
  const m = new Map<string, { code: string; name: string }>();
  for (const x of MG_MUNICIPALITIES) m.set(normTxt(x.name), { code: x.code, name: x.name });
  return m;
})();

export default function EleitoresPage() {
  const session = useAuthStore((s) => s.session);
  const voters = useCollection(collections.voters);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<IntentionFilter>('all');
  const [editing, setEditing] = useState<Voter | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Voter | null>(null);
  // Filtros avançados (#4)
  // cityFilter guarda o CÓDIGO IBGE do município ('' = todas) — combobox com os 853 de MG.
  const [cityFilter, setCityFilter] = useState<string>('');
  const [bairroFilter, setBairroFilter] = useState<string>('all');
  const [ageFilter, setAgeFilter] = useState<AgeRange | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Nome do município selecionado (cityFilter guarda o código IBGE).
  const cityName = useMemo(
    () => (cityFilter ? MG_MUNICIPALITIES.find((m) => m.code === cityFilter)?.name ?? null : null),
    [cityFilter],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    return voters.filter((v) => {
      if (filter !== 'all' && v.vote_intention !== filter) return false;
      if (cityFilter && v.municipality_code !== cityFilter && v.city !== cityName) return false;
      if (bairroFilter !== 'all' && v.neighborhood !== bairroFilter) return false;
      if (ageFilter !== 'all' && v.age_range !== ageFilter) return false;
      if (fromTs !== null || toTs !== null) {
        const t = new Date(v.created_at).getTime();
        if (fromTs !== null && t < fromTs) return false;
        if (toTs !== null && t > toTs) return false;
      }
      if (!q) return true;
      const haystack = `${v.name} ${v.city} ${v.address ?? ''} ${v.phone ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [voters, query, filter, cityFilter, cityName, bairroFilter, ageFilter, dateFrom, dateTo]);

  // Valores distintos pro select de bairro.
  const bairros = useMemo(
    () =>
      [...new Set(voters.map((v) => v.neighborhood).filter(Boolean) as string[])].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [voters],
  );
  const advancedActive =
    cityFilter !== '' ||
    bairroFilter !== 'all' ||
    ageFilter !== 'all' ||
    !!dateFrom ||
    !!dateTo;
  function clearAdvanced() {
    setCityFilter('');
    setBairroFilter('all');
    setAgeFilter('all');
    setDateFrom('');
    setDateTo('');
  }

  const counts = useMemo(() => {
    const base: Record<IntentionFilter, number> = {
      all: voters.length,
      apoiador: 0,
      tendencia_apoio: 0,
      indeciso: 0,
      tendencia_oposicao: 0,
      oposicao: 0,
    };
    for (const v of voters) base[v.vote_intention] += 1;
    return base;
  }, [voters]);

  const canManage = session?.role === 'admin' || session?.role === 'coordinator';
  const isAdmin = session?.role === 'admin';

  // Geocodificação em lote (apenas admin) — eleitores sem coordenadas.
  const [geoRunning, setGeoRunning] = useState(false);
  const [geoProgress, setGeoProgress] = useState({ done: 0, total: 0 });
  const pendingGeo = useMemo(
    () => voters.filter((v) => v.lat == null || v.lng == null),
    [voters],
  );

  async function geocodePending() {
    const targets = voters.filter((v) => v.lat == null || v.lng == null);
    if (targets.length === 0) {
      toast.info('Nenhum eleitor pendente de geocodificação.');
      return;
    }
    setGeoRunning(true);
    setGeoProgress({ done: 0, total: targets.length });
    let okc = 0;
    let failc = 0;
    for (let i = 0; i < targets.length; i++) {
      const v = targets[i];
      try {
        const result = await geocodeAddress({
          logradouro: v.logradouro,
          numero: v.numero,
          neighborhood: v.neighborhood,
          city: v.city,
          uf: 'MG',
          cep: v.cep,
        });
        if (result) {
          await collections.voters.update(v.id, {
            lat: result.lat,
            lng: result.lng,
            geo_source: 'address',
          });
          okc++;
        } else {
          failc++;
        }
      } catch {
        failc++;
      }
      setGeoProgress({ done: i + 1, total: targets.length });
    }
    setGeoRunning(false);
    toast.success(`${okc} geocodificados · ${failc} sem endereço suficiente`);
  }

  function exportCsv() {
    exportToCsv(stampedCsvName('eleitores'), filtered, [
      { header: 'Nome', value: (v) => v.name },
      { header: 'Telefone', value: (v) => v.phone },
      { header: 'Intenção de voto', value: (v) => VOTE_INTENTION_LABEL[v.vote_intention] },
      { header: 'Faixa etária', value: (v) => (v.age_range ? AGE_RANGE_LABEL[v.age_range] : '') },
      { header: 'Cidade', value: (v) => v.city },
      { header: 'Bairro', value: (v) => v.neighborhood },
      { header: 'CEP', value: (v) => v.cep },
      { header: 'Logradouro', value: (v) => v.logradouro },
      { header: 'Número', value: (v) => v.numero },
      { header: 'Complemento', value: (v) => v.complemento },
      { header: 'Observações', value: (v) => v.notes },
      { header: 'Cadastrado em', value: (v) => csvDate(v.created_at) },
    ]);
  }

  // Valida + classifica cada linha do CSV (erro/duplicado/aviso/válido) antes de gravar.
  function validateVoterRows(rows: Record<string, string>[]): ImportRowResult[] {
    // Chaves já existentes na campanha (dedup).
    const existNamePhone = new Set<string>();
    const existNameMuni = new Set<string>();
    for (const v of voters) {
      const n = normTxt(v.name);
      if (v.phone) existNamePhone.add(`${n}|${onlyDigits(v.phone)}`);
      existNameMuni.add(`${n}|${v.municipality_code ?? normTxt(v.city ?? '')}`);
    }
    // Dedup também dentro do próprio arquivo.
    const seenNamePhone = new Set<string>();
    const seenNameMuni = new Set<string>();

    return rows.map((r, i): ImportRowResult => {
      const line = i + 1;
      const name = pickField(r, 'Nome', 'name').trim();
      const cidade = pickField(r, 'Cidade', 'city', 'municipio', 'município').trim();
      const muni = cidade ? MUNI_BY_NAME.get(normTxt(cidade)) : undefined;
      const phone = pickField(r, 'Telefone', 'phone', 'celular').trim();
      const intRaw = pickField(r, 'Intenção de voto', 'intencao', 'vote_intention').trim();
      const cep = pickField(r, 'CEP', 'cep').trim();
      const secondary = [muni?.name ?? cidade, phone].filter(Boolean).join(' · ') || undefined;

      // ERRO — não importa
      const errors: string[] = [];
      if (name.length < 2) errors.push('Nome vazio ou com menos de 2 caracteres');
      if (!cidade) errors.push('Município não informado');
      else if (!muni) errors.push(`Município "${cidade}" não encontrado em MG`);
      if (intRaw && !INTENTION_BY_TEXT[normTxt(intRaw)])
        errors.push(`Intenção de voto inválida: "${intRaw}"`);
      if (errors.length)
        return { line, raw: r, status: 'error', primary: name, secondary, message: errors.join(' · ') };

      // DUPLICADO — não importa
      const nKey = normTxt(name);
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
        const key = `${nKey}|${muni?.code ?? normTxt(cidade)}`;
        if (existNameMuni.has(key) || seenNameMuni.has(key))
          return {
            line,
            raw: r,
            status: 'duplicate',
            primary: name,
            secondary,
            message: 'Nome + município já cadastrado (sem telefone)',
          };
        seenNameMuni.add(key);
      }

      // AVISO — importa com aviso
      const warnings: string[] = [];
      if (!phone) warnings.push('Sem telefone');
      if (cep && !isValidCep(cep)) warnings.push('CEP com formato inválido');
      if (warnings.length)
        return { line, raw: r, status: 'warning', primary: name, secondary, message: warnings.join(' · ') };

      return { line, raw: r, status: 'valid', primary: name, secondary };
    });
  }

  async function importVoters(rows: Record<string, string>[]) {
    if (!session?.campaign) return { ok: 0 };
    let ok = 0;
    for (const r of rows) {
      const name = pickField(r, 'Nome', 'name');
      const cidade = pickField(r, 'Cidade', 'city', 'municipio', 'município');
      const muni = cidade ? MUNI_BY_NAME.get(normTxt(cidade)) : undefined;
      await collections.voters.create({
        data: {
          campaign_id: session.campaign.id,
          created_by: session.id,
          name,
          phone: pickField(r, 'Telefone', 'phone', 'celular') || null,
          address: null,
          city: muni?.name ?? (cidade || null),
          neighborhood: pickField(r, 'Bairro', 'neighborhood') || null,
          municipality_code: muni?.code ?? null,
          cep: null,
          logradouro: null,
          numero: null,
          complemento: null,
          vote_intention: parseIntention(pickField(r, 'Intenção de voto', 'intencao', 'vote_intention')),
          age_range: parseAge(pickField(r, 'Faixa etária', 'faixa', 'age_range')),
          notes: pickField(r, 'Observações', 'obs', 'notes') || null,
          lat: null,
          lng: null,
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
          {voters.length} {voters.length === 1 ? 'eleitor cadastrado' : 'eleitores cadastrados'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ImportCsvButtons
            templateName="modelo-eleitores"
            templateRow={{
              Nome: 'José da Silva',
              Telefone: '(31) 99999-0000',
              'Intenção de voto': 'Indeciso',
              'Faixa etária': '25 a 34 anos',
              Cidade: 'Belo Horizonte',
              Bairro: 'Savassi',
            }}
            templateColumns={[
              { header: 'Nome', value: (r) => r.Nome },
              { header: 'Telefone', value: (r) => r.Telefone },
              { header: 'Intenção de voto', value: (r) => r['Intenção de voto'] },
              { header: 'Faixa etária', value: (r) => r['Faixa etária'] },
              { header: 'Cidade', value: (r) => r.Cidade },
              { header: 'Bairro', value: (r) => r.Bairro },
            ]}
            validateRows={validateVoterRows}
            onImport={importVoters}
            entityLabel="eleitores"
            successNote="Use 'Geocodificar pendentes' para adicionar coordenadas aos endereços."
          />
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          {isAdmin && pendingGeo.length > 0 ? (
            <Button variant="outline" onClick={geocodePending} disabled={geoRunning}>
              {geoRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LocateFixed className="h-4 w-4" />
              )}
              {geoRunning
                ? `Geocodificando ${geoProgress.done}/${geoProgress.total}`
                : `Geocodificar pendentes (${pendingGeo.length})`}
            </Button>
          ) : null}
          <Button
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo eleitor
          </Button>
        </div>
      </div>

      {geoRunning ? (
        <div className="rounded-lg border border-vortex-border bg-vortex-surface/40 p-3">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Geocodificando endereços (1 por segundo)…</span>
            <span>
              {geoProgress.done}/{geoProgress.total}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-vortex-bg">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${geoProgress.total ? (geoProgress.done / geoProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Buscar por nome, cidade, endereço ou telefone"
      />

      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
        <FilterPill label="Todos" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
        {(Object.keys(VOTE_INTENTION_LABEL) as VoteIntention[]).map((v) => (
          <FilterPill
            key={v}
            label={VOTE_INTENTION_LABEL[v]}
            count={counts[v]}
            active={filter === v}
            onClick={() => setFilter(v)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-vortex-border bg-vortex-surface/40 p-3">
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Cidade</Label>
          <div className="w-56">
            <MunicipalityCombobox
              value={cityFilter}
              onChange={(code) => setCityFilter(code)}
              placeholder="Todas as cidades"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Bairro</Label>
          <Select value={bairroFilter} onValueChange={setBairroFilter}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {bairros.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Faixa etária</Label>
          <Select value={ageFilter} onValueChange={(v) => setAgeFilter(v as AgeRange | 'all')}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {(Object.keys(AGE_RANGE_LABEL) as AgeRange[]).map((a) => (
                <SelectItem key={a} value={a}>
                  {AGE_RANGE_LABEL[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="date-from" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Cadastro de
          </Label>
          <Input
            id="date-from"
            type="date"
            className="h-9 w-40"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="date-to" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            até
          </Label>
          <Input
            id="date-to"
            type="date"
            className="h-9 w-40"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {advancedActive ? (
          <Button variant="ghost" size="sm" onClick={clearAdvanced} className="text-muted-foreground">
            Limpar filtros
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum eleitor encontrado"
          description="Cadastre contatos de eleitores e acompanhe a evolução da intenção de voto."
          icon={<UserCheck className="h-5 w-5" />}
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground" title={v.name}>
                    {v.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={v.city ?? undefined}>
                    {v.city}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    VOTE_INTENTION_COLOR[v.vote_intention],
                  )}
                >
                  {VOTE_INTENTION_LABEL[v.vote_intention]}
                </span>
              </div>

              <div className="space-y-1.5 text-sm">
                {v.phone ? (
                  <p className="flex items-center gap-2 text-foreground/80">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <a href={`tel:${v.phone}`} className="hover:text-primary">
                      {v.phone}
                    </a>
                  </p>
                ) : null}
                {v.address ? (
                  <p className="flex items-start gap-2 text-foreground/80">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs">{v.address}</span>
                  </p>
                ) : null}
                {v.notes ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{v.notes}</p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-vortex-border pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(v);
                    setSheetOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <OpenInMapsButton
                  target={{
                    lat: v.lat,
                    lng: v.lng,
                    logradouro: v.logradouro,
                    numero: v.numero,
                    bairro: v.neighborhood,
                    cidade: v.city,
                    uf: 'MG',
                    cep: v.cep,
                  }}
                />
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(v)}
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

      <VoterFormSheet open={sheetOpen} onOpenChange={setSheetOpen} editing={editing} />
      <ConfirmDelete
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir eleitor?"
        description={`Remover ${deleteTarget?.name ?? ''} da base. Essa ação não pode ser desfeita.`}
        onConfirm={() => deleteTarget && collections.voters.remove(deleteTarget.id)}
      />
    </div>
  );
}
