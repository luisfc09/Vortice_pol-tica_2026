import NodeCache from 'node-cache';

// Dados eleitorais históricos (anos passados) não mudam — o TTL default
// é bem longo (24h). Para dados que mudem com mais frequência basta
// passar o ttl no `setCached`. `checkperiod` faz a limpeza de chaves
// expiradas a cada 1h.
const DEFAULT_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS ?? 86_400);

const cache = new NodeCache({
  stdTTL: DEFAULT_TTL_SECONDS,
  checkperiod: 3600,
  useClones: false,
});

export function getCached<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function setCached<T>(key: string, value: T, ttl?: number): void {
  cache.set(key, value, ttl ?? DEFAULT_TTL_SECONDS);
}

// Compõe uma chave determinística a partir das partes — minúsculas e com
// `_` no lugar de espaços (evita colisões e facilita debug nos logs).
export function buildCacheKey(...parts: (string | number | undefined | null)[]): string {
  return parts
    .map((p) => (p === undefined || p === null ? '' : String(p)))
    .join('_')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

// Helper opcional para introspecção/admin endpoints.
export function cacheStats() {
  return cache.getStats();
}

export function flushCache(): void {
  cache.flushAll();
}
