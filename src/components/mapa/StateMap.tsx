import { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import { Map as MapIcon, Satellite } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type {
  Feature,
  FeatureCollection,
  GeoJsonObject,
  Geometry,
} from 'geojson';
import type {
  GeoJSON as LeafletGeoJSON,
  Layer,
  LeafletMouseEvent,
  PathOptions,
} from 'leaflet';
import { cn } from '@/lib/utils';
import type { MuniStat } from '@/data/municipalities-mg-coords';

type BaseMode = 'dark' | 'satellite';
const BASE_MODE_KEY = 'vortice:mapa-base';

interface StateMapProps {
  stats: MuniStat[];
  onSelect: (code: string) => void;
  selectedCode: string | null;
}

interface MuniProperties {
  id: string;
  name: string;
}

const MG_CENTER: [number, number] = [-18.5, -44.5];
const MG_ZOOM = 6;
const GEOJSON_URL = '/data/mg-municipios.geojson';

// Um município "sem cadastros" (0 lideranças + 0 eleitores) é diferente de
// um "cadastrado mas fraco". O primeiro é falta de inteligência; o segundo
// é território conhecidamente frio. Visualmente eles precisam contrastar.
function isUnknown(stat: MuniStat | undefined): boolean {
  if (!stat) return true;
  return stat.supporters === 0 && stat.voters === 0;
}

function colorFor(strength: number): string {
  // Escala diverging: vermelho escuro (frio) → âmbar (disputa) → lime (forte)
  if (strength <= 0.1) return '#B91C1C'; // red-700  — frio
  if (strength <= 0.3) return '#EF4444'; // red-500  — atenção
  if (strength <= 0.5) return '#F59E0B'; // amber-500 — disputa
  if (strength <= 0.7) return '#84CC16'; // lime-500 — crescente
  return '#A3E635'; //                       lime-400 / brand — consolidada
}

function styleFor(
  stat: MuniStat | undefined,
  isSelected: boolean,
  base: BaseMode,
): PathOptions {
  const isSat = base === 'satellite';
  if (isUnknown(stat)) {
    // No satélite, "sem dado" precisa ser quase transparente pra mostrar o terreno;
    // no dark, um cinza-aço discreto.
    return {
      color: isSelected ? '#A3E635' : isSat ? '#94A3B8' : '#475569',
      weight: isSelected ? 2 : isSat ? 0.5 : 0.4,
      fillColor: isSat ? '#0F172A' : '#1E293B',
      fillOpacity: isSat ? 0.08 : 0.35,
    };
  }
  return {
    // Borda mais grossa no satélite — sem ela, polígonos coloridos se misturam
    // com a vegetação. No dark, borda fina basta.
    color: isSelected ? '#A3E635' : isSat ? '#0B1120' : '#0F172A',
    weight: isSelected ? 2.4 : isSat ? 0.9 : 0.6,
    fillColor: colorFor(stat!.strength),
    fillOpacity: isSat ? 0.62 : 0.78,
  };
}

export function StateMap({ stats, onSelect, selectedCode }: StateMapProps) {
  const [geo, setGeo] = useState<FeatureCollection<Geometry, MuniProperties> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState<BaseMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = window.localStorage.getItem(BASE_MODE_KEY);
    return stored === 'satellite' ? 'satellite' : 'dark';
  });
  const layerRef = useRef<LeafletGeoJSON | null>(null);

  // Persiste a preferência do usuário entre sessões.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BASE_MODE_KEY, base);
  }, [base]);

  // Index stats por código IBGE — lookup O(1) no styler.
  const statByCode = useMemo(() => {
    const m = new Map<string, MuniStat>();
    for (const s of stats) m.set(s.code, s);
    return m;
  }, [stats]);

  // Carrega o GeoJSON dos 853 municípios uma vez.
  useEffect(() => {
    let active = true;
    fetch(GEOJSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: FeatureCollection<Geometry, MuniProperties>) => {
        if (active) setGeo(json);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'fetch falhou');
      });
    return () => {
      active = false;
    };
  }, []);

  // Re-aplica estilo quando stats, seleção ou base mudam (sem destruir a layer).
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.eachLayer((sub) => {
      const f = (sub as unknown as { feature?: Feature<Geometry, MuniProperties> }).feature;
      if (!f) return;
      const code = String(f.properties.id);
      const stat = statByCode.get(code);
      const isSelected = code === selectedCode;
      (sub as unknown as { setStyle: (s: PathOptions) => void }).setStyle(
        styleFor(stat, isSelected, base),
      );
    });
  }, [statByCode, selectedCode, base]);

  return (
    <MapContainer
      center={MG_CENTER}
      zoom={MG_ZOOM}
      scrollWheelZoom
      className="h-[600px] w-full rounded-xl border border-vortex-border"
      // `isolation: isolate` cria stacking context — prende os z-indexes
      // internos do Leaflet (controles em 1000, attribution em 800) e impede
      // que se sobreponham a drawers/dialogs renderizados via portal.
      style={{ backgroundColor: '#0A0F1E', isolation: 'isolate' }}
    >
      {base === 'dark' ? (
        <>
          <TileLayer
            key="carto-dark-base"
            attribution='&copy; <a href="https://carto.com/">CARTO</a> &amp; OpenStreetMap'
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          />
          <TileLayer
            key="carto-dark-labels"
            url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
            opacity={0.55}
          />
        </>
      ) : (
        <>
          <TileLayer
            key="esri-world-imagery"
            attribution='Tiles &copy; Esri — World Imagery'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />
          <TileLayer
            key="esri-boundaries-places"
            attribution='Boundaries & Places &copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            opacity={0.85}
          />
        </>
      )}

      {geo ? (
        <GeoJSON
          ref={(node) => {
            // react-leaflet@4 expõe a layer via ref
            layerRef.current = (node as unknown as LeafletGeoJSON | null) ?? null;
          }}
          data={geo as GeoJsonObject}
          style={(feature) => {
            const code = String(
              (feature as Feature<Geometry, MuniProperties>).properties.id,
            );
            const stat = statByCode.get(code);
            return styleFor(stat, code === selectedCode, base);
          }}
          onEachFeature={(feature, layer: Layer) => {
            const f = feature as Feature<Geometry, MuniProperties>;
            const code = String(f.properties.id);
            const name = f.properties.name;
            layer.on({
              click: () => onSelect(code),
              mouseover: (e: LeafletMouseEvent) => {
                const target = e.target as unknown as {
                  setStyle: (s: PathOptions) => void;
                  bringToFront: () => void;
                };
                target.setStyle({ weight: 2, color: '#A3E635' });
                target.bringToFront();
              },
              mouseout: () => {
                const stat = statByCode.get(code);
                const target = layer as unknown as {
                  setStyle: (s: PathOptions) => void;
                };
                target.setStyle(styleFor(stat, code === selectedCode, base));
              },
            });
            const stat = statByCode.get(code);
            const lid = stat?.supporters ?? 0;
            const ele = stat?.voters ?? 0;
            const force = stat ? Math.round(stat.strength * 100) : 0;
            layer.bindTooltip(
              `<div style="font-size:11px;line-height:1.3">
                <div style="font-weight:600">${name}</div>
                <div>Lideranças: ${lid} · Eleitores: ${ele}</div>
                <div>Força: ${force}%</div>
              </div>`,
              { direction: 'top', sticky: true, opacity: 0.95 },
            );
          }}
        />
      ) : null}

      {error ? (
        <div className="absolute left-3 top-3 z-[400] rounded-md border border-red-500/40 bg-red-500/15 px-2 py-1 text-[11px] text-red-200">
          Mapa: não foi possível carregar GeoJSON ({error}).
        </div>
      ) : null}

      <div className="absolute right-3 top-3 z-[400] flex overflow-hidden rounded-md border border-vortex-border bg-vortex-surface/90 text-xs shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => setBase('dark')}
          aria-pressed={base === 'dark'}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 transition-colors',
            base === 'dark'
              ? 'bg-vortex-lime/20 text-vortex-lime'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <MapIcon className="h-3.5 w-3.5" />
          Mapa
        </button>
        <button
          type="button"
          onClick={() => setBase('satellite')}
          aria-pressed={base === 'satellite'}
          className={cn(
            'flex items-center gap-1.5 border-l border-vortex-border px-2.5 py-1.5 transition-colors',
            base === 'satellite'
              ? 'bg-vortex-lime/20 text-vortex-lime'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Satellite className="h-3.5 w-3.5" />
          Satélite
        </button>
      </div>
    </MapContainer>
  );
}
