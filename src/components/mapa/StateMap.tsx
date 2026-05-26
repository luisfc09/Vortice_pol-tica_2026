import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { MuniStat } from '@/data/municipalities-mg-coords';

interface StateMapProps {
  stats: MuniStat[];
  onSelect: (code: string) => void;
  selectedCode: string | null;
}

// Bounds aproximados de Minas Gerais
const MG_CENTER: [number, number] = [-18.5, -44.5];
const MG_ZOOM = 6;

function colorFor(strength: number): string {
  // escala 0..1 → vermelho → amarelo → lime
  if (strength <= 0.1) return '#7F1D1D';
  if (strength <= 0.3) return '#DC2626';
  if (strength <= 0.5) return '#F59E0B';
  if (strength <= 0.7) return '#84CC16';
  return '#A3E635';
}

function radiusFor(stat: MuniStat): number {
  const total = stat.supporters + stat.voters;
  return Math.min(28, 6 + Math.sqrt(total) * 2.5);
}

export function StateMap({ stats, onSelect, selectedCode }: StateMapProps) {
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
        opacity={0.6}
      />

      {stats.map((s) => {
        const isSelected = s.code === selectedCode;
        const color = colorFor(s.strength);
        return (
          <CircleMarker
            key={s.code}
            center={[s.lat, s.lng]}
            radius={radiusFor(s)}
            pathOptions={{
              color: isSelected ? '#A3E635' : color,
              weight: isSelected ? 3 : 1.5,
              fillColor: color,
              fillOpacity: 0.6,
            }}
            eventHandlers={{
              click: () => onSelect(s.code),
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <div className="text-xs">
                <p className="font-semibold">{s.name}</p>
                <p>
                  Lideranças: {s.supporters} · Eleitores: {s.voters}
                </p>
                <p>Força: {Math.round(s.strength * 100)}%</p>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
