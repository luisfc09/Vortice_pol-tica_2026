import { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
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
import type { MuniStat } from '@/data/municipalities-mg-coords';

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

function colorFor(strength: number | undefined): string {
  if (strength === undefined) return '#1F2937'; // sem dado: cinza-azulado
  if (strength <= 0.1) return '#7F1D1D';
  if (strength <= 0.3) return '#DC2626';
  if (strength <= 0.5) return '#F59E0B';
  if (strength <= 0.7) return '#84CC16';
  return '#A3E635';
}

function styleFor(strength: number | undefined, isSelected: boolean): PathOptions {
  const fill = colorFor(strength);
  return {
    color: isSelected ? '#A3E635' : '#0A0F1E',
    weight: isSelected ? 2 : 0.5,
    fillColor: fill,
    fillOpacity: strength === undefined ? 0.18 : 0.62,
  };
}

export function StateMap({ stats, onSelect, selectedCode }: StateMapProps) {
  const [geo, setGeo] = useState<FeatureCollection<Geometry, MuniProperties> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const layerRef = useRef<LeafletGeoJSON | null>(null);

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

  // Re-aplica estilo quando stats ou seleção mudam (sem destruir a layer).
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
        styleFor(stat?.strength, isSelected),
      );
    });
  }, [statByCode, selectedCode]);

  return (
    <MapContainer
      center={MG_CENTER}
      zoom={MG_ZOOM}
      scrollWheelZoom
      className="h-[600px] w-full rounded-xl border border-vortex-border"
      style={{ backgroundColor: '#0A0F1E' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a> &amp; OpenStreetMap'
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
      />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
        opacity={0.55}
      />

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
            return styleFor(stat?.strength, code === selectedCode);
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
                target.setStyle(styleFor(stat?.strength, code === selectedCode));
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
    </MapContainer>
  );
}
