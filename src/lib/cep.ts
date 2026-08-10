// ============================================================================
// Busca de endereço por CEP (ViaCEP) + máscara.
// ----------------------------------------------------------------------------
// ViaCEP é público, gratuito e com CORS liberado pra uso client-side. Não
// precisa de chave. Retorna o código IBGE (7 dígitos) no MESMO formato do
// MG_MUNICIPALITIES — permite auto-selecionar o município pelo CEP.
// ============================================================================

export interface CepAddress {
  cep: string; // só dígitos
  logradouro: string;
  bairro: string;
  localidade: string; // cidade
  uf: string;
  ibge: string; // código IBGE 7 dígitos (casa com MG_MUNICIPALITIES.code)
}

/** Remove tudo que não é dígito e limita a 8. */
export function onlyCepDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

/** Máscara visual "00000-000". Aceita entrada parcial. */
export function formatCep(value: string): string {
  const d = onlyCepDigits(value);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Busca o endereço de um CEP. Devolve null se o CEP for inválido, não existir
 * ou a rede falhar (o chamador segue com preenchimento manual).
 */
export async function lookupCep(rawCep: string): Promise<CepAddress | null> {
  const cep = onlyCepDigits(rawCep);
  if (cep.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
      ibge?: string;
    };
    if (data.erro) return null;
    return {
      cep,
      logradouro: data.logradouro ?? '',
      bairro: data.bairro ?? '',
      localidade: data.localidade ?? '',
      uf: data.uf ?? '',
      ibge: data.ibge ?? '',
    };
  } catch {
    return null;
  }
}
