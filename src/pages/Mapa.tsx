import { useMemo, useState } from 'react';
import { StateMap } from '@/components/mapa/StateMap';
import { MapLegend } from '@/components/mapa/MapLegend';
import { MunicipalityDrawer } from '@/components/mapa/MunicipalityDrawer';
import { collections, useCollection } from '@/lib/data';
import {
  MUNI_COORDS,
  populationOf,
  type MuniStat,
} from '@/data/municipalities-mg-coords';

const LEGEND = [
  { color: '#7F1D1D', label: '0–10% — território frio' },
  { color: '#DC2626', label: '10–30% — atenção' },
  { color: '#F59E0B', label: '30–50% — disputa' },
  { color: '#84CC16', label: '50–70% — força crescente' },
  { color: '#A3E635', label: '70–100% — base consolidada' },
];

export default function MapaPage() {
  const supporters = useCollection(collections.supporters);
  const voters = useCollection(collections.voters);
  const [selected, setSelected] = useState<string | null>(null);

  const stats: MuniStat[] = useMemo(() => {
    const codes = Object.keys(MUNI_COORDS);
    return codes.map((code) => {
      const supList = supporters.filter((s) => s.municipality_code === code);
      const votList = voters.filter((v) => v.municipality_code === code);
      const apo = votList.filter((v) => v.vote_intention === 'apoiador').length;
      const tend = votList.filter((v) => v.vote_intention === 'tendencia_apoio').length;
      const pop = populationOf(code);
      // força = (lideranças * 8 + apoiadores + tendencia*0.5) / pop * 1000, clamp 0..1
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

  const selectedStat = selected ? stats.find((s) => s.code === selected) ?? null : null;
  const selectedSupporters = selected
    ? supporters.filter((s) => s.municipality_code === selected)
    : [];
  const selectedVoters = selected ? voters.filter((v) => v.municipality_code === selected) : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {stats.length} municípios mapeados (IBGE) · clique no município para ver o detalhe.
      </p>

      <div className="relative">
        <StateMap stats={stats} onSelect={setSelected} selectedCode={selected} />
        <div className="absolute bottom-4 right-4 z-[400] hidden lg:block">
          <MapLegend scale={LEGEND} />
        </div>
      </div>

      <div className="lg:hidden">
        <MapLegend scale={LEGEND} />
      </div>

      <MunicipalityDrawer
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        name={selectedStat?.name ?? null}
        population={selectedStat?.population ?? 0}
        supporters={selectedSupporters}
        voters={selectedVoters}
        strength={selectedStat?.strength ?? 0}
      />
    </div>
  );
}
