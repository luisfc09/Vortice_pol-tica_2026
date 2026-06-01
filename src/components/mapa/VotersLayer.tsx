// Camada de pontos no mapa Leaflet — um CircleMarker leve por eleitor com
// coordenadas conhecidas, colorido pela intenção de voto. Renderizado dentro
// de um <MapContainer> do react-leaflet (não cria mapa próprio).

import { CircleMarker, Tooltip } from 'react-leaflet';
import { VOTE_INTENTION_LABEL, type Voter, type VoteIntention } from '@/types';

// Paleta de 5 cores (conforme spec aprovada).
const COLOR: Record<VoteIntention, string> = {
  apoiador: '#22c55e',          // favor — verde
  tendencia_apoio: '#86efac',   // likely_favor — verde claro
  indeciso: '#94a3b8',          // undecided — cinza
  tendencia_oposicao: '#fb923c', // likely_against — laranja
  oposicao: '#ef4444',          // against — vermelho
};

interface Props {
  /** Lista de eleitores (já filtrados pelo painel). Só renderiza os que têm lat/lng. */
  voters: Voter[];
}

export function VotersLayer({ voters }: Props) {
  // Filtra os que possuem coordenadas — voters sem geocode são pulados.
  const withCoords = voters.filter(
    (v): v is Voter & { lat: number; lng: number } => v.lat != null && v.lng != null,
  );

  return (
    <>
      {withCoords.map((v) => {
        const color = COLOR[v.vote_intention];
        return (
          <CircleMarker
            key={v.id}
            center={[v.lat, v.lng]}
            radius={5}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.75,
              weight: 1,
              opacity: 0.95,
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.95} sticky>
              <div className="text-xs leading-tight">
                <p className="font-semibold">{v.name}</p>
                <p>{VOTE_INTENTION_LABEL[v.vote_intention]}</p>
                {v.city ? <p className="opacity-70">{v.city}</p> : null}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
