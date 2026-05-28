import { useEffect, useMemo, useRef, useState } from 'react';
import {
  tseApi,
  type TseCandidato,
  type TseCombinacao,
  type TseMapaResposta,
} from '@/lib/tseApi';
import { comboKey } from '@/components/mapa/TseControls';

interface UseTseEleicao {
  combinacoes: TseCombinacao[];
  selectedKey: string | null;
  setSelectedKey: (k: string) => void;
  selected: TseCombinacao | null;
  mapa: TseMapaResposta | null;
  candidatos: TseCandidato[];
  loadingCombos: boolean;
  loadingData: boolean;
  error: string | null;
}

// Orquestra os dados eleitorais do TSE pro Mapa:
//  - carrega as combinações (ano/cargo/turno) quando habilitado
//  - ao escolher uma eleição, busca o resumo do mapa + ranking estadual
// `enabled` evita disparar requests enquanto o usuário está no modo Campanha.
export function useTseEleicao(enabled: boolean): UseTseEleicao {
  const [combinacoes, setCombinacoes] = useState<TseCombinacao[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mapa, setMapa] = useState<TseMapaResposta | null>(null);
  const [candidatos, setCandidatos] = useState<TseCandidato[]>([]);
  const [loadingCombos, setLoadingCombos] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedCombos = useRef(false);

  // 1) Carrega combinações uma vez (na primeira ativação)
  useEffect(() => {
    if (!enabled || fetchedCombos.current) return;
    fetchedCombos.current = true;
    setLoadingCombos(true);
    setError(null);
    const ctrl = new AbortController();
    tseApi
      .combinacoes(ctrl.signal)
      .then((combos) => {
        setCombinacoes(combos);
        if (combos.length > 0) setSelectedKey(comboKey(combos[0]));
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) {
          fetchedCombos.current = false; // permite retry numa próxima ativação
          setError(e instanceof Error ? e.message : 'Falha ao carregar eleições.');
        }
      })
      .finally(() => setLoadingCombos(false));
    return () => ctrl.abort();
  }, [enabled]);

  const selected = useMemo(
    () => combinacoes.find((c) => comboKey(c) === selectedKey) ?? null,
    [combinacoes, selectedKey],
  );

  // 2) Ao mudar a eleição selecionada, busca mapa + ranking
  useEffect(() => {
    if (!enabled || !selected) return;
    const ctrl = new AbortController();
    setLoadingData(true);
    setError(null);
    const params = {
      ano: selected.ano,
      cargo: selected.cargo_codigo,
      turno: selected.turno,
      uf: selected.uf,
    };
    Promise.all([
      tseApi.mapa(params, ctrl.signal),
      tseApi.candidatos({ ...params, limit: 1000 }, ctrl.signal),
    ])
      .then(([mapaResp, cands]) => {
        setMapa(mapaResp);
        setCandidatos(cands);
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) {
          setMapa(null);
          setCandidatos([]);
          setError(e instanceof Error ? e.message : 'Falha ao carregar dados da eleição.');
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingData(false);
      });
    return () => ctrl.abort();
  }, [enabled, selected]);

  return {
    combinacoes,
    selectedKey,
    setSelectedKey,
    selected,
    mapa,
    candidatos,
    loadingCombos,
    loadingData,
    error,
  };
}
