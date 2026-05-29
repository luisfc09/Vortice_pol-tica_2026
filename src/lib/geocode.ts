// Geocodificação via Nominatim (OpenStreetMap) com cache de CEP e throttle.
//
// REGRAS DE USO DO NOMINATIM (obrigatórias):
//   - Máximo 1 requisição por segundo (usamos 1100ms entre chamadas).
//   - User-Agent identificável.
//   - Sem uso em lote agressivo: o cache de CEP + cache em memória evitam
//     repetir chamadas para o mesmo endereço/CEP.

import { supabase, USE_MOCKS } from '@/lib/supabase';
import { onlyDigits } from '@/lib/csv-import';
import type { GeoSource } from '@/types';

export type GeoAccuracy = 'gps' | 'address' | 'cep' | 'city';

export interface GeocodeResult {
  lat: number;
  lng: number;
  source: GeoSource;
  accuracy: GeoAccuracy;
}

export interface GeoTarget {
  logradouro?: string | null;
  numero?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  uf?: string | null;
  cep?: string | null;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Vortice-Electoral-System/1.0';
const THROTTLE_MS = 1100;

// Garante no mínimo 1100ms entre chamadas ao Nominatim (compartilhado no app).
let lastRequestAt = 0;
// Cache em memória por query (dura a sessão) — reduz chamadas durante o lote.
const memCache = new Map<string, GeocodeResult | null>();

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function throttle() {
  const wait = THROTTLE_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

const fmtCep = (digits: string) =>
  digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;

// --- cache persistente (tabela geocode_cache, chaveada por CEP) ---
async function readCepCache(cepDigits: string): Promise<{ lat: number; lng: number } | null> {
  if (USE_MOCKS) return null;
  const { data, error } = await supabase
    .from('geocode_cache')
    .select('lat,lng')
    .eq('cep', cepDigits)
    .maybeSingle();
  if (error || !data) return null;
  return { lat: data.lat as number, lng: data.lng as number };
}

async function writeCepCache(cepDigits: string, lat: number, lng: number): Promise<void> {
  if (USE_MOCKS) return;
  await supabase.from('geocode_cache').upsert({ cep: cepDigits, lat, lng }, { onConflict: 'cep' });
}

async function queryNominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  await throttle();
  try {
    const url = `${NOMINATIM}?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(json) || json.length === 0) return null;
    const lat = parseFloat(json[0].lat);
    const lng = parseFloat(json[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Geocodifica um endereço com fallback progressivo:
 *   1. Endereço completo (logradouro + número + bairro + cidade + UF)
 *   2. Só CEP
 *   3. Só cidade + UF
 * Verifica o cache de CEP antes de chamar o Nominatim e grava o resultado
 * (nível rua/CEP) no cache depois. Retorna null se não houver dados suficientes.
 */
export async function geocodeAddress(target: GeoTarget): Promise<GeocodeResult | null> {
  const uf = (target.uf || 'MG').trim();
  const city = (target.city || '').trim();
  const neighborhood = (target.neighborhood || '').trim();
  const logradouro = (target.logradouro || '').trim();
  const numero = (target.numero || '').trim();
  const cepDigits = onlyDigits(target.cep);
  const hasCep = cepDigits.length === 8;

  // Fast-path: CEP já no cache → não chama o Nominatim.
  if (hasCep) {
    const cached = await readCepCache(cepDigits);
    if (cached) return { lat: cached.lat, lng: cached.lng, source: 'address', accuracy: 'cep' };
  }

  // Monta as tentativas, da mais precisa para a mais aproximada.
  const attempts: Array<{ q: string; accuracy: GeoAccuracy }> = [];
  if (logradouro && city) {
    const parts = [logradouro, numero, neighborhood, city, uf, 'Brasil'].filter(Boolean);
    attempts.push({ q: parts.join(', '), accuracy: 'address' });
  }
  if (hasCep) {
    attempts.push({ q: `${fmtCep(cepDigits)}, Brasil`, accuracy: 'cep' });
  }
  if (city) {
    attempts.push({ q: `${city}, ${uf}, Brasil`, accuracy: 'city' });
  }
  if (attempts.length === 0) return null;

  for (const a of attempts) {
    const memKey = a.q.toLowerCase();
    if (memCache.has(memKey)) {
      const hit = memCache.get(memKey)!;
      if (hit) return hit;
      continue;
    }
    const coords = await queryNominatim(a.q);
    const hit: GeocodeResult | null = coords
      ? { lat: coords.lat, lng: coords.lng, source: 'address', accuracy: a.accuracy }
      : null;
    memCache.set(memKey, hit);
    if (hit) {
      // Só grava no cache de CEP quando o resultado é nível rua/CEP (não polui com nível cidade).
      if (hasCep && (hit.accuracy === 'address' || hit.accuracy === 'cep')) {
        await writeCepCache(cepDigits, hit.lat, hit.lng);
      }
      return hit;
    }
  }
  return null;
}
