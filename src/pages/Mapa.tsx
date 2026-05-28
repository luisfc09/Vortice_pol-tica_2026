import { useEffect, useMemo, useState } from 'react';
import { Map as MapIcon, Vote } from 'lucide-react';
import { StateMap, type MapCell } from '@/components/mapa/StateMap';
import { MapLegend } from '@/components/mapa/MapLegend';
import { MunicipalityDrawer } from '@/components/mapa/MunicipalityDrawer';
import { TseControls } from '@/components/mapa/TseControls';
import { TseResumoPanel } from '@/components/mapa/TseResumoPanel';
import { TseMunicipioDrawer } from '@/components/mapa/TseMunicipioDrawer';
import { MunicipalityCombobox } from '@/components/ui/municipality-combobox';
import { collections, useCollection } from '@/lib/data';
import { useTseEleicao } from '@/hooks/useTseEleicao';
import { tseApi, type TseMapaMunicipio, type TseMunicipioRanking } from '@/lib/tseApi';
import { colorForParty, tseNomeToIbge } from '@/lib/tseGeo';
import { cn } from '@/lib/utils';
import {
  MUNI_COORDS,
  populationOf,
  type MuniStat,
} from '@/data/municipalities-mg-coords';

type Mode = 'campanha' | 'tse';

const LEGEND = [
  { color: '#1E293B', label: 'Sem cadastros' },
  { color: '#B91C1C', label: '0–10% — território frio' },
  { color: '#EF4444', label: '10–30% — atenção' },
  { color: '#F59E0B', label: '30–50% — disputa' },
  { color: '#84CC16', label: '50–70% — força crescente' },
  { color: '#A3E635', label: '70–100% — base consolidada' },
];

const fmt = new Intl.NumberFormat('pt-BR');

function colorForStrength(s: number): string {
  if (s <= 0.1) return '#B91C1C';
  if (s <= 0.3) return '#EF4444';
  if (s <= 0.5) return '#F59E0B';
  if (s <= 0.7) return '#84CC16';
  return '#A3E635';
}

export default function MapaPage() {
  const supporters = useCollection(collections.supporters);
  const voters = useCollection(collections.voters);
  const [mode, setMode] = useState<Mode>('campanha');

  // ----- Modo Campanha (força política — comportamento original) -----------
  const stats: MuniStat[] = useMemo(() => {
    const codes = Object.keys(MUNI_COORDS);
    return codes.map((code) => {
      const supList = supporters.filter((s) => s.municipality_code === code);
      const votList = voters.filter((v) => v.municipality_code === code);
      const apo = votList.filter((v) => v.vote_intention === 'apoiador').length;
      const tend = votList.filter((v) => v.vote_intention === 'tendencia_apoio').length;
      const pop = populationOf(code);
      const raw = (supList.length * 8 + apo + tend * 0.5) / (pop / 1000);
      const strength = Math.max(0, Math.min(1, raw / 30));
      const meta = MUNI_COORDS[code];
      return {
        code,
        name: meta.name,
        lat: meta.lat,
        lng: meta.lng,
        supporters: supList.length,
        voters: votList.length,
        apoiadores: apo,
        population: pop,
        strength,
      };
    });
  }, [supporters, voters]);

  const campanhaCells = useMemo(() => {
    const m = new Map<string, MapCell>();
    for (const s of stats) {
      const known = s.supporters > 0 || s.voters > 0;
      const force = Math.round(s.strength * 100);
      m.set(s.code, {
        fill: colorForStrength(s.strength),
        known,
        tooltip: `<div style="font-size:11px;line-height:1.3"><div style="font-weight:600">${s.name}</div><div>Lideranças: ${s.supporters} · Eleitores: ${s.voters}</div><div>Força: ${force}%</div></div>`,
      });
    }
    return m;
  }, [stats]);

  const [selectedCampanha, setSelectedCampanha] = useState<string | null>(null);
  const selectedStat = selectedCampanha
    ? stats.find((s) => s.code === selectedCampanha) ?? null
    : null;
  const selectedSupporters = selectedCampanha
    ? supporters.filter((s) => s.municipality_code === selectedCampanha)
    : [];
  const selectedVoters = selectedCampanha
    ? voters.filter((v) => v.municipality_code === selectedCampanha)
    : [];

  // ----- Modo TSE (resultados eleitorais) ----------------------------------
  const tse = useTseEleicao(mode === 'tse');

  // Mapeia cada município do TSE pro código IBGE do GeoJSON (join por nome).
  const tseByIbge = useMemo(() => {
    const m = new Map<string, TseMapaMunicipio>();
    if (!tse.mapa) return m;
    for (const muni of tse.mapa.municipios) {
      const ibge = tseNomeToIbge(muni.municipio_nome);
      if (ibge) m.set(ibge, muni);
    }
    return m;
  }, [tse.mapa]);

  const naoCasados = tse.mapa ? tse.mapa.total_municipios - tseByIbge.size : 0;

  // Opções pro seletor de município (alfabético) — só os que têm dado na
  // eleição selecionada. code = IBGE (pra casar com selectedTse e o mapa).
  const tseMuniOptions = useMemo(() => {
    if (!tse.mapa) return [];
    return tse.mapa.municipios
      .map((m) => ({ code: tseNomeToIbge(m.municipio_nome) ?? '', name: m.municipio_nome }))
      .filter((o) => o.code)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [tse.mapa]);

  const tseCells = useMemo(() => {
    const m = new Map<string, MapCell>();
    for (const [ibge, muni] of tseByIbge) {
      const l = muni.lider;
      m.set(ibge, {
        fill: colorForParty(l.partido),
        known: true,
        tooltip: `<div style="font-size:11px;line-height:1.35"><div style="font-weight:600">${muni.municipio_nome}</div><div>Líder: ${l.nome_urna || l.nome} (${l.partido ?? '—'})</div><div>${fmt.format(l.votos)} votos · ${muni.n_candidatos} candidatos</div></div>`,
      });
    }
    return m;
  }, [tseByIbge]);

  // Drawer do município no modo TSE
  const [selectedTse, setSelectedTse] = useState<string | null>(null);
  const [ranking, setRanking] = useState<TseMunicipioRanking | null>(null);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTse || !tse.selected) return;
    const muni = tseByIbge.get(selectedTse);
    if (!muni) {
      setRanking(null);
      setRankingError('Sem resultado deste município nesta eleição.');
      return;
    }
    const ctrl = new AbortController();
    setLoadingRanking(true);
    setRankingError(null);
    tseApi
      .municipio(
        muni.municipio_codigo,
        {
          ano: tse.selected.ano,
          cargo: tse.selected.cargo_codigo,
          turno: tse.selected.turno,
          uf: tse.selected.uf,
        },
        ctrl.signal,
      )
      .then(setRanking)
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) {
          setRanking(null);
          setRankingError(e instanceof Error ? e.message : 'Falha ao carregar município.');
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingRanking(false);
      });
    return () => ctrl.abort();
  }, [selectedTse, tse.selected, tseByIbge]);

  // Ao trocar de modo, fecha qualquer drawer aberto.
  useEffect(() => {
    setSelectedCampanha(null);
    setSelectedTse(null);
  }, [mode]);

  // ----- Render ------------------------------------------------------------
  const cells = mode === 'tse' ? tseCells : campanhaCells;
  const selectedCode = mode === 'tse' ? selectedTse : selectedCampanha;
  const handleSelect = (code: string) => {
    if (mode === 'tse') setSelectedTse(code);
    else setSelectedCampanha(code);
  };

  return (
    <div className="space-y-4">
      {/* Toggle de modo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex overflow-hidden rounded-lg border border-vortex-border bg-vortex-surface/60 text-sm">
          <ModeButton active={mode === 'campanha'} onClick={() => setMode('campanha')} icon={<MapIcon className="h-4 w-4" />}>
            Campanha
          </ModeButton>
          <ModeButton active={mode === 'tse'} onClick={() => setMode('tse')} icon={<Vote className="h-4 w-4" />}>
            Eleições (TSE)
          </ModeButton>
        </div>

        {mode === 'tse' ? (
          <TseControls
            combinacoes={tse.combinacoes}
            value={tse.selectedKey}
            onChange={tse.setSelectedKey}
            loading={tse.loadingCombos}
          />
        ) : null}
      </div>

      {/* Seletor de município (modo TSE) — busca alfabética. Sempre visível
          no modo TSE; desabilita enquanto a eleição não foi escolhida. */}
      {mode === 'tse' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-vortex-border bg-vortex-surface/40 p-3">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            🔎 Buscar município
          </label>
          <div className="w-[320px] max-w-full">
            <MunicipalityCombobox
              value={selectedTse ?? ''}
              onChange={(code) => setSelectedTse(code || null)}
              options={tseMuniOptions}
              disabled={!tse.mapa || tse.loadingData}
              placeholder={
                !tse.selected
                  ? 'Selecione a eleição acima primeiro'
                  : tse.loadingData
                    ? 'Carregando municípios…'
                    : `Buscar entre ${tseMuniOptions.length} municípios…`
              }
            />
          </div>
          <span className="text-xs text-muted-foreground">
            digite o nome e veja quem ganhou · ou clique direto no mapa
          </span>
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {mode === 'campanha' ? (
          <>
            {stats.length} municípios mapeados (IBGE) · cor = força da campanha · clique pra ver o
            detalhe.
          </>
        ) : (
          <>
            Cor = partido do candidato mais votado em cada município · clique pra ver o ranking.
            {naoCasados > 0 ? (
              <span className="ml-1 text-amber-300/80">
                ({naoCasados} município(s) sem correspondência no mapa)
              </span>
            ) : null}
          </>
        )}
      </p>

      <div className="relative">
        <StateMap cells={cells} onSelect={handleSelect} selectedCode={selectedCode} />
        {mode === 'campanha' ? (
          <div className="absolute bottom-4 right-4 z-[400] hidden lg:block">
            <MapLegend scale={LEGEND} />
          </div>
        ) : null}
      </div>

      {mode === 'campanha' ? (
        <div className="lg:hidden">
          <MapLegend scale={LEGEND} />
        </div>
      ) : null}

      {/* Painel abaixo do mapa */}
      {mode === 'tse' ? (
        <TseResumoPanel
          mapa={tse.mapa}
          candidatos={tse.candidatos}
          loading={tse.loadingData}
          error={tse.error}
        />
      ) : null}

      {/* Drawers */}
      <MunicipalityDrawer
        open={mode === 'campanha' && selectedCampanha !== null}
        onOpenChange={(o) => !o && setSelectedCampanha(null)}
        name={selectedStat?.name ?? null}
        population={selectedStat?.population ?? 0}
        supporters={selectedSupporters}
        voters={selectedVoters}
        strength={selectedStat?.strength ?? 0}
      />

      <TseMunicipioDrawer
        open={mode === 'tse' && selectedTse !== null}
        onOpenChange={(o) => !o && setSelectedTse(null)}
        ranking={ranking}
        loading={loadingRanking}
        error={rankingError}
        cargoLabel={tse.selected?.cargo_label ?? ''}
        ano={tse.selected?.ano ?? 0}
        turno={tse.selected?.turno ?? 1}
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 px-3.5 py-2 transition-colors',
        active
          ? 'bg-vortex-lime/20 text-vortex-lime'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
