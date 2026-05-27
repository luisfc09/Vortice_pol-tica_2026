/**
 * Importador de resultados eleitorais do TSE.
 *
 * Uso:
 *   npm run import:tse -- --ano 2022 --uf MG --cargo 7
 *   npm run import:tse -- --ano 2024 --uf MG --cargo 13 --turno 1
 *
 * O que faz:
 *  1. Resolve o package_show do dataset 'resultados-{ANO}' no CKAN
 *  2. Encontra o recurso "Votação nominal por município e zona" (CSV ZIP)
 *  3. Baixa o ZIP em memória, descompacta
 *  4. Localiza dentro do ZIP o CSV do UF solicitado (ex.: votacao_candidato_munzona_2022_MG.csv)
 *  5. Lê o CSV em latin1 com separador ';'
 *  6. Filtra por cargo (e turno)
 *  7. Agrega votos por (município × candidato) — soma as zonas
 *  8. Upsert em batches na tabela public.tse_resultados
 *
 * Idempotente: a constraint única (ano, turno, uf, municipio, cargo, sequencial)
 * faz upsert via supabase-js.
 */

import 'dotenv/config';
import { parse } from 'csv-parse';
import AdmZip from 'adm-zip';
import axios from 'axios';
import { sbAdmin } from '../lib/supabase';
import { CARGOS } from '../lib/tseClient';

interface CliArgs {
  ano: string;
  uf: string;
  cargo?: string;
  turno?: string;
  dryRun?: boolean;
}

function parseArgs(): CliArgs {
  const out: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const val = argv[i + 1];
      out[key] = val;
      i += 1;
    }
  }
  if (!out.ano) throw new Error('Faltando --ano (ex.: --ano 2022)');
  if (!out.uf) throw new Error('Faltando --uf (ex.: --uf MG)');
  return {
    ano: String(out.ano),
    uf: String(out.uf).toUpperCase(),
    cargo: out.cargo ? String(out.cargo) : undefined,
    turno: out.turno ? String(out.turno) : undefined,
    dryRun: !!out.dryRun,
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

interface CkanPackage {
  resources: { id: string; name: string; format?: string; url: string }[];
}

async function findVotacaoMunZonaResource(ano: string): Promise<string> {
  const url = `https://dadosabertos.tse.jus.br/api/3/action/package_show?id=resultados-${ano}`;
  const res = await axios.get<{ result: CkanPackage }>(url, { timeout: 20_000 });
  const resources = res.data.result.resources;

  // Procura o resource de "Votação nominal por município e zona".
  // O nome varia por ano, mas sempre contém 'nominal' e 'município/munzona'.
  const candidate = resources.find((r) => {
    const n = r.name.toLowerCase();
    return (
      (n.includes('nominal') && (n.includes('município') || n.includes('munzona'))) ||
      n === 'votação nominal por município e zona'
    );
  });
  if (!candidate) {
    throw new Error(
      `Recurso "Votação nominal por município e zona" não encontrado em resultados-${ano}.`,
    );
  }
  return candidate.url;
}

async function downloadZip(url: string): Promise<Buffer> {
  console.log(`[download] ${url}`);
  const start = Date.now();
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 180_000, // 3 minutos — arquivos grandes
  });
  const buf = Buffer.from(res.data);
  console.log(
    `[download] ${(buf.length / 1024 / 1024).toFixed(1)} MB em ${(
      (Date.now() - start) /
      1000
    ).toFixed(1)}s`,
  );
  return buf;
}

function pickCsvForUf(zip: AdmZip, uf: string, ano: string): Buffer {
  const entries = zip.getEntries();
  // Procura entry cujo nome contém o UF (ex.: '..._MG.csv'). TSE também publica
  // arquivos BRASIL/_BR.csv (agregado) — esses a gente ignora.
  const target = entries.find((e) => {
    const n = e.entryName.toLowerCase();
    if (!n.endsWith('.csv')) return false;
    if (n.includes('_brasil') || n.includes('_br.')) return false;
    return n.includes(`_${uf.toLowerCase()}.csv`) || n.includes(`-${uf.toLowerCase()}.csv`);
  });
  if (!target) {
    const names = entries.map((e) => e.entryName).join('\n  ');
    throw new Error(
      `CSV do UF ${uf} (${ano}) não encontrado dentro do ZIP. Entries:\n  ${names}`,
    );
  }
  console.log(`[zip] usando ${target.entryName} (${(target.header.size / 1024).toFixed(0)} KB)`);
  return target.getData();
}

// ----------------------------------------------------------------------------
// CSV → linhas agregadas
// ----------------------------------------------------------------------------

interface RawRow {
  ANO_ELEICAO?: string;
  NR_TURNO?: string;
  SG_UF?: string;
  CD_MUNICIPIO?: string;
  NM_MUNICIPIO?: string;
  CD_CARGO?: string;
  DS_CARGO?: string;
  SQ_CANDIDATO?: string;
  NR_CANDIDATO?: string;
  NM_CANDIDATO?: string;
  NM_URNA_CANDIDATO?: string;
  SG_PARTIDO?: string;
  NR_PARTIDO?: string;
  NM_COLIGACAO?: string;
  DS_SIT_TOT_TURNO?: string;
  QT_VOTOS_NOMINAIS?: string;
  // Variantes mais antigas
  QT_VOTOS_NOMINAIS_VALIDOS?: string;
  QT_VOTOS?: string;
}

interface AggregateKey {
  ano: number;
  turno: number;
  uf: string;
  municipio_codigo: string;
  municipio_nome: string;
  cargo_codigo: string;
  cargo_label: string | null;
  numero_candidato: string;
  nome_candidato: string;
  nome_urna: string | null;
  sequencial_candidato: string;
  partido_sigla: string | null;
  partido_numero: string | null;
  coligacao: string | null;
  situacao: string | null;
}

interface AggregatedRow extends AggregateKey {
  votos: number;
}

function keyOf(k: AggregateKey): string {
  return [
    k.ano,
    k.turno,
    k.uf,
    k.municipio_codigo,
    k.cargo_codigo,
    k.sequencial_candidato,
  ].join('|');
}

function safeStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length === 0 || s === '#NULO#' || s === '#NULO' ? null : s;
}

function aggregateRows(
  csvBuf: Buffer,
  filter: { cargo?: string; turno?: string; ano: string; uf: string },
): Promise<AggregatedRow[]> {
  return new Promise((resolve, reject) => {
    const map = new Map<string, AggregatedRow>();
    let totalLines = 0;
    let matched = 0;

    const parser = parse({
      columns: true,
      delimiter: ';',
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });

    parser.on('readable', () => {
      let rec: RawRow | null;
      while ((rec = parser.read() as RawRow | null) !== null) {
        totalLines += 1;
        if (filter.cargo && rec.CD_CARGO !== filter.cargo) continue;
        if (filter.turno && rec.NR_TURNO !== filter.turno) continue;

        // Pula linhas inválidas (sem candidato)
        const seq = safeStr(rec.SQ_CANDIDATO);
        const muniCod = safeStr(rec.CD_MUNICIPIO);
        const muniNom = safeStr(rec.NM_MUNICIPIO);
        if (!seq || !muniCod || !muniNom) continue;

        const votos = parseInt(
          rec.QT_VOTOS_NOMINAIS || rec.QT_VOTOS_NOMINAIS_VALIDOS || rec.QT_VOTOS || '0',
          10,
        );
        if (!Number.isFinite(votos) || votos === 0) {
          // Linhas com 0 votos não vão pro banco — economiza espaço
          continue;
        }

        const key: AggregateKey = {
          ano: parseInt(rec.ANO_ELEICAO || filter.ano, 10),
          turno: parseInt(rec.NR_TURNO || '1', 10),
          uf: rec.SG_UF || filter.uf,
          municipio_codigo: muniCod,
          municipio_nome: muniNom,
          cargo_codigo: rec.CD_CARGO || '0',
          cargo_label: safeStr(rec.DS_CARGO) ?? CARGOS[rec.CD_CARGO || ''] ?? null,
          numero_candidato: safeStr(rec.NR_CANDIDATO) ?? '',
          nome_candidato: safeStr(rec.NM_CANDIDATO) ?? '—',
          nome_urna: safeStr(rec.NM_URNA_CANDIDATO),
          sequencial_candidato: seq,
          partido_sigla: safeStr(rec.SG_PARTIDO),
          partido_numero: safeStr(rec.NR_PARTIDO),
          coligacao: safeStr(rec.NM_COLIGACAO),
          situacao: safeStr(rec.DS_SIT_TOT_TURNO),
        };

        const k = keyOf(key);
        const existing = map.get(k);
        if (existing) {
          existing.votos += votos;
        } else {
          map.set(k, { ...key, votos });
        }
        matched += 1;
      }
    });

    parser.on('end', () => {
      console.log(
        `[parse] ${totalLines.toLocaleString('pt-BR')} linhas lidas, ${matched.toLocaleString('pt-BR')} bateram no filtro, ${map.size.toLocaleString('pt-BR')} candidatos × municípios agregados.`,
      );
      resolve([...map.values()]);
    });

    parser.on('error', reject);

    // CSV do TSE é em ISO-8859-1 (latin1). Buffer.toString converte e a gente
    // alimenta o parser com string.
    parser.write(csvBuf.toString('latin1'));
    parser.end();
  });
}

// ----------------------------------------------------------------------------
// Upsert em batches
// ----------------------------------------------------------------------------

async function upsertBatches(rows: AggregatedRow[]) {
  const sb = sbAdmin();
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await sb
      .from('tse_resultados')
      .upsert(chunk, {
        onConflict: 'ano,turno,uf,municipio_codigo,cargo_codigo,sequencial_candidato',
      });
    if (error) {
      throw new Error(`Supabase upsert falhou no batch ${i}-${i + BATCH}: ${error.message}`);
    }
    inserted += chunk.length;
    process.stdout.write(`\r[upsert] ${inserted}/${rows.length} (${Math.round((inserted / rows.length) * 100)}%)`);
  }
  console.log();
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  console.log('[import] argumentos:', args);

  // 1. Descobre URL do ZIP
  const zipUrl = await findVotacaoMunZonaResource(args.ano);

  // 2. Baixa
  const zipBuf = await downloadZip(zipUrl);

  // 3. Descompacta e pega CSV do UF
  const zip = new AdmZip(zipBuf);
  const csvBuf = pickCsvForUf(zip, args.uf, args.ano);

  // 4. Parseia + filtra + agrega
  const rows = await aggregateRows(csvBuf, {
    ano: args.ano,
    uf: args.uf,
    cargo: args.cargo,
    turno: args.turno,
  });

  if (rows.length === 0) {
    console.log('[import] zero linhas agregadas — nada pra inserir.');
    return;
  }

  // 5. Mostra prévia
  console.log('[import] prévia (5 maiores por votos):');
  rows
    .slice()
    .sort((a, b) => b.votos - a.votos)
    .slice(0, 5)
    .forEach((r) =>
      console.log(
        `  ${r.municipio_nome.padEnd(28)} ${r.nome_candidato.padEnd(35)} ${(r.partido_sigla ?? '—').padEnd(8)} ${r.votos.toLocaleString('pt-BR')} votos`,
      ),
    );

  if (args.dryRun) {
    console.log('[import] --dry-run: pulando upsert.');
    return;
  }

  // 6. Upsert
  await upsertBatches(rows);
  console.log(`[import] ✅ ${rows.length} linhas importadas em public.tse_resultados.`);
}

main().catch((err) => {
  console.error('[import] FALHA:', err instanceof Error ? err.message : err);
  process.exit(1);
});
