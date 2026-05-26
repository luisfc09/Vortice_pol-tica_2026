import { useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPinOff, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FilterPill } from '@/components/data/FilterPill';
import {
  INTENTION_COLOR,
  PERIOD_LABEL,
  filterByPeriod,
  buildVisitsBreakdown,
  type Period,
} from '@/lib/campo-hoje';
import { VOTE_INTENTION_LABEL, type FieldInterview, type VoteIntention } from '@/types';

const MG_CENTER: [number, number] = [-18.5, -44.5];

interface Props {
  interviews: FieldInterview[];
  period: Period;
  onChangePeriod: (p: Period) => void;
}

export function TodayVisitsMap({ interviews, period, onChangePeriod }: Props) {
  const filtered = useMemo(() => filterByPeriod(interviews, period), [interviews, period]);
  const { markers, clusters, neighborhoodsWithoutGps } = useMemo(
    () => buildVisitsBreakdown(filtered),
    [filtered],
  );

  const totalWithGps = markers.length + clusters.reduce((s, c) => s + c.count, 0);

  // Centro do mapa: média dos pontos se houver, senão centro de MG
  const center = useMemo<[number, number]>(() => {
    const pts = [
      ...markers.map((m) => [m.lat, m.lng] as [number, number]),
      ...clusters.map((c) => [c.lat, c.lng] as [number, number]),
    ];
    if (pts.length === 0) return MG_CENTER;
    const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return [lat, lng];
  }, [markers, clusters]);

  const initialZoom = totalWithGps > 0 ? 11 : 6;

  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Visitas de campo
          </p>
          <p className="font-display text-xl tracking-wide text-foreground">
            {filtered.length} entrevista{filtered.length === 1 ? '' : 's'} ·{' '}
            {PERIOD_LABEL[period]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <FilterPill
              key={p}
              label={PERIOD_LABEL[p]}
              active={period === p}
              onClick={() => onChangePeriod(p)}
            />
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {(Object.keys(INTENTION_COLOR) as VoteIntention[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full border border-white/10"
              style={{ backgroundColor: INTENTION_COLOR[k] }}
            />
            {VOTE_INTENTION_LABEL[k]}
          </span>
        ))}
      </div>

      {totalWithGps === 0 ? (
        <EmptyMap neighborhoodsWithoutGps={neighborhoodsWithoutGps} period={period} />
      ) : (
        <>
          <MapContainer
            center={center}
            zoom={initialZoom}
            scrollWheelZoom
            className="h-[420px] w-full rounded-lg border border-vortex-border"
            style={{ backgroundColor: '#0A0F1E', isolation: 'isolate' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
            />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
              opacity={0.6}
            />

            {markers.map((m) => (
              <CircleMarker
                key={m.id}
                center={[m.lat, m.lng]}
                radius={8}
                pathOptions={{
                  color: INTENTION_COLOR[m.intention],
                  weight: 2,
                  fillColor: INTENTION_COLOR[m.intention],
                  fillOpacity: 0.8,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <div className="text-xs">
                    <p className="font-semibold">{m.voterName}</p>
                    {m.neighborhood ? <p>{m.neighborhood}</p> : null}
                    <p>{VOTE_INTENTION_LABEL[m.intention]}</p>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}

            {clusters.map((c) => (
              <Marker
                key={c.key}
                position={[c.lat, c.lng]}
                icon={buildClusterIcon(c.count)}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <div className="text-xs">
                    <p className="font-semibold">
                      {c.neighborhood} — {c.count} visitas
                    </p>
                    {(Object.keys(c.intentionsBreakdown) as VoteIntention[]).map((k) =>
                      c.intentionsBreakdown[k] > 0 ? (
                        <p key={k}>
                          {VOTE_INTENTION_LABEL[k]}: {c.intentionsBreakdown[k]}
                        </p>
                      ) : null,
                    )}
                  </div>
                </Tooltip>
              </Marker>
            ))}
          </MapContainer>

          {neighborhoodsWithoutGps.length > 0 ? (
            <div className="mt-3 rounded-lg border border-vortex-border bg-vortex-bg/40 p-3 text-xs text-muted-foreground">
              <p className="mb-1 flex items-center gap-1.5 text-foreground">
                <MapPinOff className="h-3 w-3" /> Sem GPS: {neighborhoodsWithoutGps.length}{' '}
                bairros
              </p>
              <p>{neighborhoodsWithoutGps.join(' · ')}</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function EmptyMap({
  neighborhoodsWithoutGps,
  period,
}: {
  neighborhoodsWithoutGps: string[];
  period: Period;
}) {
  if (neighborhoodsWithoutGps.length === 0) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-vortex-border bg-vortex-bg/40 text-center">
        <MapPinOff className="mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-foreground">Sem visitas registradas</p>
        <p className="text-xs text-muted-foreground">
          Nenhuma entrevista no período {PERIOD_LABEL[period].toLowerCase()}.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-vortex-border bg-vortex-bg/40 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-foreground">
        <MapPinOff className="h-4 w-4 text-amber-400" />
        Entrevistas sem GPS — bairros visitados
      </div>
      <div className="flex flex-wrap gap-2">
        {neighborhoodsWithoutGps.map((h) => (
          <Badge key={h} variant="outline">
            {h}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// Ícone HTML do cluster com contagem
function buildClusterIcon(count: number) {
  const size = count > 20 ? 48 : count > 10 ? 40 : 34;
  return L.divIcon({
    className: 'vortice-cluster',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;
      display:flex;align-items:center;justify-content:center;
      background:rgba(163,230,53,0.18);
      border:2px solid #A3E635;
      border-radius:9999px;
      color:#A3E635;
      font-weight:700;
      font-family:system-ui,-apple-system,sans-serif;
      font-size:${count > 20 ? 16 : 14}px;
      box-shadow:0 0 0 4px rgba(163,230,53,0.08);
    ">${count}</div>`,
  });
}
