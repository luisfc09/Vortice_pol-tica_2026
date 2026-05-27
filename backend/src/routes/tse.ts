import { Router, Request, Response } from 'express';
import { tseClient, CARGOS } from '../lib/tseClient';
import { buildCacheKey, cacheStats, flushCache, getCached, setCached } from '../lib/cache';

const router = Router();

// Útil pra UI: estrutura tipada do resultado normalizado.
interface NormalizedRecord {
  municipio: string;
  municipio_codigo: string;
  cargo: string;
  cargo_codigo: string;
  candidato: string;
  numero: string;
  partido: string;
  votos: number;
  zona: string;
  secao: string;
  ano: string;
  uf: string;
}

interface CandidatoAgregado {
  candidato: string;
  numero: string;
  partido: string;
  votos: number;
}

// Resposta de erro padronizada — sempre 4xx/5xx com { error, hint?, step? }
function sendError(res: Response, status: number, error: string, extra: Record<string, unknown> = {}) {
  res.status(status).json({ error, ...extra });
}

// GET /api/tse/health — testa conexão com o CKAN do TSE.
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const datasets = await tseClient.listarDatasets();
    res.json({
      status: 'ok',
      tse_conectado: true,
      datasets_disponiveis: datasets.length,
      cargos: CARGOS,
    });
  } catch (error) {
    res.status(503).json({
      status: 'erro',
      tse_conectado: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/tse/cargos — lista os cargos suportados pelo enum.
router.get('/cargos', (_req: Request, res: Response) => {
  res.json(Object.entries(CARGOS).map(([cd, nm]) => ({ cd, nm })));
});

// GET /api/tse/resultados
// Query: ano, uf, municipio, cargo, candidato, limit, offset
router.get('/resultados', async (req: Request, res: Response) => {
  try {
    const {
      ano = '2022',
      uf = 'MG',
      municipio,
      cargo,
      candidato,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    const cacheKey = buildCacheKey(
      'resultados',
      ano,
      uf,
      municipio || 'todos',
      cargo || 'todos',
      candidato || 'todos',
      limit,
      offset,
    );

    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return res.json({ ...(cached as object), from_cache: true });
    }

    const data = await tseClient.buscarResultados({
      ano,
      uf,
      municipio,
      cargo,
      candidato,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    const records: NormalizedRecord[] = data.records.map((r) => ({
      municipio: r.NM_MUNICIPIO,
      municipio_codigo: r.CD_MUNICIPIO,
      cargo: CARGOS[r.CD_CARGO] ?? r.CD_CARGO,
      cargo_codigo: r.CD_CARGO,
      candidato: r.NM_CANDIDATO ?? r.NM_VOTAVEL,
      numero: r.NR_CANDIDATO ?? r.NR_VOTAVEL,
      partido: r.SG_PARTIDO,
      votos: parseInt(r.QT_VOTOS || '0', 10),
      zona: r.NR_ZONA,
      secao: r.NR_SECAO,
      ano,
      uf,
    }));

    const result = { records, total: data.total, ano, uf };
    setCached(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Erro TSE /resultados:', error);
    sendError(res, 500, 'Erro ao buscar dados do TSE', {
      detalhe: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/tse/municipios/:municipio
// Resultado completo de um município com agregação por candidato.
router.get('/municipios/:municipio', async (req: Request, res: Response) => {
  try {
    const { municipio } = req.params;
    const { ano = '2022', cargo = '7', uf = 'MG' } = req.query as Record<string, string>;

    const cacheKey = buildCacheKey('municipio', municipio, ano, cargo, uf);
    const cached = getCached<unknown>(cacheKey);
    if (cached) return res.json({ ...(cached as object), from_cache: true });

    const data = await tseClient.buscarResultados({
      ano,
      uf,
      municipio,
      cargo,
      limit: 500,
    });

    // Agrega votos por candidato (somando seções/zonas).
    const porCandidato = data.records.reduce<Record<string, CandidatoAgregado>>(
      (acc, r) => {
        const num = r.NR_CANDIDATO ?? r.NR_VOTAVEL;
        if (!num) return acc;
        if (!acc[num]) {
          acc[num] = {
            candidato: r.NM_CANDIDATO ?? r.NM_VOTAVEL ?? '—',
            numero: num,
            partido: r.SG_PARTIDO ?? '—',
            votos: 0,
          };
        }
        acc[num].votos += parseInt(r.QT_VOTOS || '0', 10);
        return acc;
      },
      {},
    );

    const ranking = Object.values(porCandidato)
      .sort((a, b) => b.votos - a.votos)
      .map((c, i) => ({ ...c, posicao: i + 1 }));

    const result = {
      municipio: municipio.toUpperCase(),
      ano,
      uf,
      cargo: CARGOS[cargo] ?? cargo,
      cargo_codigo: cargo,
      total_votos: ranking.reduce((s, c) => s + c.votos, 0),
      candidatos: ranking,
    };

    setCached(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Erro TSE /municipios:', error);
    sendError(res, 500, 'Erro ao buscar dados do TSE', {
      detalhe: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/tse/candidatos
// Query: ano, uf, cargo, nome, numero
router.get('/candidatos', async (req: Request, res: Response) => {
  try {
    const {
      ano = '2022',
      uf = 'MG',
      cargo,
      nome,
      numero,
    } = req.query as Record<string, string>;

    const cacheKey = buildCacheKey(
      'candidatos',
      ano,
      uf,
      cargo || '',
      nome || '',
      numero || '',
    );
    const cached = getCached<unknown>(cacheKey);
    if (cached) return res.json({ data: cached, from_cache: true });

    const records = await tseClient.buscarCandidatos({ ano, uf, cargo, nome, numero });
    setCached(cacheKey, records);
    res.json({ data: records, total: records.length });
  } catch (error) {
    console.error('Erro TSE /candidatos:', error);
    sendError(res, 500, 'Erro ao buscar candidatos', {
      detalhe: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/tse/cache/stats — útil pra debug
router.get('/cache/stats', (_req: Request, res: Response) => {
  res.json(cacheStats());
});

// POST /api/tse/cache/flush — limpa o cache (útil em desenvolvimento)
router.post('/cache/flush', (_req: Request, res: Response) => {
  flushCache();
  res.json({ ok: true });
});

export default router;
