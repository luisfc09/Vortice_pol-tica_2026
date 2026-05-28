import { useEffect, useRef, useState } from 'react';
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

type BaseMode = 'dark' | 'satellite';
const BASE_MODE_KEY = 'vortice:mapa-base';

// Célula genérica do choropleth: cada município (por código IBGE) tem uma
// cor de preenchimento, um tooltip (HTML) e um flag "known". Quem monta as
// células é a página (modo Campanha → força; modo TSE → partido líder).
export interface MapCell {
  fill: string;
  fillOpacity?: number;
  tooltip: string; // HTML
  known: boolean; // false → estilo "sem dado"
}

interface StateMapProps {
  cells: Map<string, MapCell>;
  onSelect: (code: string) => void;
  selectedCode: string | null;
  /** Altura do mapa (default h-[600px]). */
  heightClass?: string;
}

interface MuniProperties {
  id: string;
  name: string;
}

const MG_CENTER: [number, number] = [-18.5, -44.5];
const MG_ZOOM = 6;
const GEOJSON_URL = '/data/mg-municipios.geojson';

function styleFor(
  cell: MapCell | undefined,
  isSelected: boolean,
  base: BaseMode,
): PathOptions {
  const isSat = base === 'satellite';
  if (!cell || !cell.known) {
    // "sem dado": quase transparente no satélite; cinza-aço discreto no dark.
    return {
      color: isSelected ? '#A3E635' : isSat ? '#94A3B8' : '#475569',
      weight: isSelected ? 2 : isSat ? 0.5 : 0.4,
      fillColor: isSat ? '#0F172A' : '#1E293B',
      fillOpacity: isSat ? 0.08 : 0.35,
    };
  }
  return {
    color: isSelected ? '#A3E635' : isSat ? '#0B1120' : '#0F172A',
    weight: isSelected ? 2.4 : isSat ? 0.9 : 0.6,
    fillColor: cell.fill,
    fillOpacity: cell.fillOpacity ?? (isSat ? 0.62 : 0.78),
  };
}

export function StateMap({ cells, onSelect, selectedCode, heightClass }: StateMapProps) {
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BASE_MODE_KEY, base);
  }, [base]);

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

  // Re-aplica estilo + tooltip quando as células, seleção ou base mudam
  // (sem destruir a layer).
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.eachLayer((sub) => {
      const f = (sub as unknown as { feature?: Feature<Geometry, MuniProperties> }).feature;
      if (!f) return;
      const code = String(f.properties.id);
      const cell = cells.get(code);
      const isSelected = code === selectedCode;
      (sub as unknown as { setStyle: (s: PathOptions) => void }).setStyle(
        styleFor(cell, isSelected, base),
      );
      // Atualiza tooltip
      const name = f.properties.name;
      const html =
        cell?.tooltip ??
        `<div style="font-size:11px"><div style="font-weight:600">${name}</div><div>sem dado</div></div>`;
      const withTip = sub as unknown as {
        getTooltip?: () => unknown;
        setTooltipContent?: (h: string) => void;
        bindTooltip: (h: string, o: Record<string, unknown>) => void;
      };
      if (withTip.getTooltip && withTip.getTooltip()) {
        withTip.setTooltipContent?.(html);
      } else {
        withTip.bindTooltip(html, { direction: 'top', sticky: true, opacity: 0.95 });
      }
    });
  }, [cells, selectedCode, base]);

  return (
    <MapContainer
      center={MG_CENTER}
      zoom={MG_ZOOM}
      scrollWheelZoom
      className={cn('w-full rounded-xl border border-vortex-border', heightClass ?? 'h-[600px]')}
      // `isolation: isolate` cria stacking context — prende os z-indexes
      // internos do Leaflet e impede que se sobreponham a drawers/dialogs.
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
            layerRef.current = (node as unknown as LeafletGeoJSON | null) ?? null;
          }}
          data={geo as GeoJsonObject}
          style={(feature) => {
            const code = String(
              (feature as Feature<Geometry, MuniProperties>).properties.id,
            );
            return styleFor(cells.get(code), code === selectedCode, base);
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
                const target = layer as unknown as {
                  setStyle: (s: PathOptions) => void;
                };
                target.setStyle(styleFor(cells.get(code), code === selectedCode, base));
              },
            });
            const cell = cells.get(code);
            const html =
              cell?.tooltip ??
              `<div style="font-size:11px"><div style="font-weight:600">${name}</div><div>sem dado</div></div>`;
            layer.bindTooltip(html, { direction: 'top', sticky: true, opacity: 0.95 });
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
