import { Router, Request, Response } from 'express';
import { CARGOS } from '../lib/tseClient';
import { sbAnon } from '../lib/supabase';
import { buildCacheKey, cacheStats, flushCache, getCached, setCached } from '../lib/cache';

// As rotas abaixo consultam a tabela `tse_resultados` no Supabase, que é
// alimentada pelo importer CLI (npm run import:tse). NÃO consultam o CKAN
// do TSE em request time — o CKAN é lento, instável, e não tem
// datastore_search ativo nos datasets atuais (todos os resources estão como
// `datastore_active: false`, ou seja, só dão pra baixar ZIP).
//
// Mantemos `/health` e `/cargos` como endpoints leves (sem rede).

const router = Router();

// Resposta de erro padronizada
function sendError(res: Response, status: number, error: string, extra: Record<string, unknown> = {}) {
  res.status(status).json({ error, ...extra });
}

// GET /api/tse/health
// Testa conexão com o Supabase (faz um COUNT barato). Não toca o CKAN.
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const { count, error } = await sbAnon()
      .from('tse_resultados')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    res.json({
      status: 'ok',
      supabase_conectado: true,
      total_registros: count ?? 0,
      cargos: CARGOS,
    });
  } catch (error) {
    res.status(503).json({
      status: 'erro',
      supabase_conectado: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/tse/cargos — lista os cargos suportados (constante in-process).
router.get('/cargos', (_req: Request, res: Response) => {
  res.json(Object.entries(CARGOS).map(([cd, nm]) => ({ cd, nm })));
});

// GET /api/tse/resultados
// Query: ano, uf, municipio (nome ou código), cargo, candidato (nome ou número),
//        turno, partido, limit, offset, order ('votos' | 'nome')
//
// Resposta: { records: [...], total, ano, uf, limit, offset }
router.get('/resultados', async (req: Request, res: Response) => {
  try {
    const {
      ano = '2022',
      uf = 'MG',
      municipio,
      cargo,
      candidato,
      turno = '1',
      partido,
      limit = '100',
      offset = '0',
      order = 'votos',
    } = req.query as Record<string, string>;

    const limitNum = Math.min(parseInt(limit, 10) || 100, 1000);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    const cacheKey = buildCacheKey(
      'resultados',
      ano,
      uf,
      turno,
      municipio || 'todos',
      cargo || 'todos',
      candidato || 'todos',
      partido || 'todos',
      String(limitNum),
      String(offsetNum),
      order,
    );

    const cached = getCached<unknown>(cacheKey);
    if (cached) {
      return res.json({ ...(cached as object), from_cache: true });
    }

    let query = sbAnon()
      .from('tse_resultados')
      .select(
        'ano, turno, uf, municipio_codigo, municipio_nome, cargo_codigo, cargo_label, numero_candidato, nome_candidato, nome_urna, sequencial_candidato, partido_sigla, partido_numero, coligacao, situacao, votos',
        { count: 'exact' },
      )
      .eq('ano', parseInt(ano, 10))
      .eq('uf', uf.toUpperCase())
      .eq('turno', parseInt(turno, 10));

    if (cargo) query = query.eq('cargo_codigo', cargo);
    if (partido) query = query.eq('partido_sigla', partido.toUpperCase());

    if (municipio) {
      // Aceita tanto código IBGE/TSE quanto nome (heurística: só dígitos = código).
      if (/^\d+$/.test(municipio)) {
        query = query.eq('municipio_codigo', municipio);
      } else {
        query = query.ilike('municipio_nome', `%${municipio}%`);
      }
    }

    if (candidato) {
      if (/^\d+$/.test(candidato)) {
        query = query.eq('numero_candidato', candidato);
      } else {
        query = query.ilike('nome_candidato', `%${candidato}%`);
      }
    }

    if (order === 'nome') {
      query = query.order('nome_candidato', { ascending: true });
    } else {
      query = query.order('votos', { ascending: false });
    }

    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    // Normaliza shape pro frontend (mantém compatibilidade com o
    // formato antigo que vinha do CKAN, mas já vem agregado por município).
    const records = (data ?? []).map((r) => ({
      municipio: r.municipio_nome,
      municipio_codigo: r.municipio_codigo,
      cargo: r.cargo_label ?? CARGOS[r.cargo_codigo] ?? r.cargo_codigo,
      cargo_codigo: r.cargo_codigo,
      candidato: r.nome_candidato,
      nome_urna: r.nome_urna,
      numero: r.numero_candidato,
      sequencial: r.sequencial_candidato,
      partido: r.partido_sigla,
      partido_numero: r.partido_numero,
      coligacao: r.coligacao,
      situacao: r.situacao,
      votos: r.votos,
      turno: r.turno,
      ano: String(r.ano),
      uf: r.uf,
    }));

    const result = {
      records,
      total: count ?? records.length,
      ano,
      uf,
      limit: limitNum,
      offset: offsetNum,
    };
    setCached(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Erro /resultados:', error);
    sendError(res, 500, 'Erro ao buscar resultados', {
      detalhe: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/tse/municipios/:municipio
// Ranking de candidatos num município (já vem agregado da tabela).
// Path param aceita nome OU código. Query: ano, cargo, uf, turno.
router.get('/municipios/:municipio', async (req: Request, res: Response) => {
  try {
    const { municipio } = req.params;
    const {
      ano = '2022',
      cargo = '7',
      uf = 'MG',
      turno = '1',
    } = req.query as Record<string, string>;

    const cacheKey = buildCacheKey('municipio', municipio, ano, cargo, uf, turno);
    const cached = getCached<unknown>(cacheKey);
    if (cached) return res.json({ ...(cached as object), from_cache: true });

    let query = sbAnon()
      .from('tse_resultados')
      .select(
        'municipio_codigo, municipio_nome, nome_candidato, nome_urna, numero_candidato, sequencial_candidato, partido_sigla, partido_numero, coligacao, situacao, votos, cargo_codigo, cargo_label, turno',
      )
      .eq('ano', parseInt(ano, 10))
      .eq('uf', uf.toUpperCase())
      .eq('cargo_codigo', cargo)
      .eq('turno', parseInt(turno, 10))
      .order('votos', { ascending: false })
      .limit(2000);

    if (/^\d+$/.test(municipio)) {
      query = query.eq('municipio_codigo', municipio);
    } else {
      query = query.ilike('municipio_nome', municipio);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      return res.json({
        municipio: municipio.toUpperCase(),
        ano,
        uf,
        cargo: CARGOS[cargo] ?? cargo,
        cargo_codigo: cargo,
        total_votos: 0,
        candidatos: [],
        empty: true,
      });
    }

    const ranking = data.map((r, i) => ({
      posicao: i + 1,
      candidato: r.nome_candidato,
      nome_urna: r.nome_urna,
      numero: r.numero_candidato,
      sequencial: r.sequencial_candidato,
      partido: r.partido_sigla,
      partido_numero: r.partido_numero,
      coligacao: r.coligacao,
      situacao: r.situacao,
      votos: r.votos,
    }));

    const totalVotos = ranking.reduce((s, c) => s + (c.votos ?? 0), 0);
    const first = data[0];

    const result = {
      municipio: first.municipio_nome,
      municipio_codigo: first.municipio_codigo,
      ano,
      uf,
      turno: parseInt(turno, 10),
      cargo: first.cargo_label ?? CARGOS[cargo] ?? cargo,
      cargo_codigo: cargo,
      total_votos: totalVotos,
      candidatos: ranking,
    };

    setCached(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Erro /municipios:', error);
    sendError(res, 500, 'Erro ao buscar dados do município', {
      detalhe: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/tse/candidatos
// Lista candidatos agregados (soma de votos de TODOS os municípios).
// Query: ano, uf, cargo, nome, numero, partido, turno, limit.
//
// Usa a RPC tse_candidatos_agregados — a agregação roda NO BANCO
// (GROUP BY + SUM). Fazer isso em memória no Node não funciona porque o
// PostgREST corta a resposta em ~1000 linhas, e dep federal tem 183k+.
router.get('/candidatos', async (req: Request, res: Response) => {
  try {
    const {
      ano = '2022',
      uf = 'MG',
      cargo,
      nome,
      numero,
      partido,
      turno = '1',
      limit = '500',
    } = req.query as Record<string, string>;

    const limitNum = Math.min(parseInt(limit, 10) || 500, 2000);

    const cacheKey = buildCacheKey(
      'candidatos',
      ano,
      uf,
      cargo || '',
      nome || '',
      numero || '',
      partido || '',
      turno,
      String(limitNum),
    );
    const cached = getCached<unknown>(cacheKey);
    if (cached) return res.json({ data: cached, from_cache: true });

    const { data, error } = await sbAnon().rpc('tse_candidatos_agregados', {
      p_ano: parseInt(ano, 10),
      p_uf: uf.toUpperCase(),
      p_cargo: cargo ?? null,
      p_turno: parseInt(turno, 10),
      p_nome: nome ?? null,
      p_numero: numero ?? null,
      p_partido: partido ? partido.toUpperCase() : null,
      p_limit: limitNum,
    });
    if (error) throw error;

    // Normaliza shape (RPC devolve snake_case; mantemos chaves amigáveis)
    const records = (data ?? []).map((r: Record<string, unknown>) => ({
      candidato: r.nome_candidato,
      nome_urna: r.nome_urna,
      numero: r.numero_candidato,
      sequencial: r.sequencial_candidato,
      partido: r.partido_sigla,
      partido_numero: r.partido_numero,
      situacao: r.situacao,
      cargo_codigo: r.cargo_codigo,
      votos: Number(r.votos ?? 0),
      municipios: Number(r.municipios ?? 0),
    }));

    setCached(cacheKey, records);
    res.json({ data: records, total: records.length });
  } catch (error) {
    console.error('Erro /candidatos:', error);
    sendError(res, 500, 'Erro ao buscar candidatos', {
      detalhe: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/tse/anos — combinações (ano, turno, uf, cargo) presentes na base,
// com contagem de linhas e municípios. Pro frontend popular dropdowns.
// Usa a RPC tse_combinacoes (DISTINCT/GROUP BY no banco).
router.get('/anos', async (_req: Request, res: Response) => {
  try {
    const cached = getCached<unknown>('combinacoes-disponiveis');
    if (cached) return res.json({ data: cached, from_cache: true });

    const { data, error } = await sbAnon().rpc('tse_combinacoes');
    if (error) throw error;

    const list = (data ?? []).map((r: Record<string, unknown>) => ({
      ano: Number(r.ano),
      turno: Number(r.turno),
      uf: r.uf,
      cargo_codigo: r.cargo_codigo,
      cargo_label: CARGOS[String(r.cargo_codigo)] ?? r.cargo_codigo,
      linhas: Number(r.linhas ?? 0),
      municipios: Number(r.municipios ?? 0),
    }));

    setCached('combinacoes-disponiveis', list);
    res.json({ data: list });
  } catch (error) {
    console.error('Erro /anos:', error);
    sendError(res, 500, 'Erro ao listar combinações disponíveis', {
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
