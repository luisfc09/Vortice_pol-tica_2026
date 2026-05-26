// Deep links pro Google Maps — sem API key, gratuitos, funcionam em
// desktop e mobile (no celular abrem direto no app do Maps se instalado).
//
// Docs: https://developers.google.com/maps/documentation/urls/get-started

export interface MapsTarget {
  lat?: number | null;
  lng?: number | null;
  // Componentes do endereço para fallback quando não há coordenada.
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

function hasCoords(t: MapsTarget): t is MapsTarget & { lat: number; lng: number } {
  return typeof t.lat === 'number' && typeof t.lng === 'number';
}

function joinAddress(t: MapsTarget): string {
  const street =
    t.logradouro && t.numero
      ? `${t.logradouro}, ${t.numero}`
      : t.logradouro ?? t.numero ?? '';
  const parts = [street, t.bairro, t.cidade, t.uf ? `${t.uf}` : null, t.cep]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  return parts.join(', ');
}

/**
 * Devolve true quando há algo (coordenada OU endereço minimamente útil)
 * pra abrir no Maps. Use no `disabled` do botão.
 */
export function isMappable(t: MapsTarget | null | undefined): boolean {
  if (!t) return false;
  if (hasCoords(t)) return true;
  return joinAddress(t).length > 0;
}

/**
 * Modo:
 * - `search`: abre o ponto sem traçar rota (apenas mostra)
 * - `directions`: abre o app/site com rota desde a posição atual
 */
export function mapsUrl(
  t: MapsTarget,
  mode: 'search' | 'directions' = 'directions',
): string | null {
  const base = 'https://www.google.com/maps';
  if (hasCoords(t)) {
    const coord = `${t.lat},${t.lng}`;
    if (mode === 'directions') {
      return `${base}/dir/?api=1&destination=${coord}`;
    }
    return `${base}/search/?api=1&query=${coord}`;
  }
  const address = joinAddress(t);
  if (!address) return null;
  const q = encodeURIComponent(address);
  if (mode === 'directions') {
    return `${base}/dir/?api=1&destination=${q}`;
  }
  return `${base}/search/?api=1&query=${q}`;
}
