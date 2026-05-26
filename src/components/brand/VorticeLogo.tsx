import { useState } from 'react';
import { cn } from '@/lib/utils';

interface VorticeLogoProps {
  className?: string;
  size?: number;
  decorative?: boolean;
}

// Caminhos dos assets em public/brand/. Troque a extensão aqui se você
// salvar em PNG/WEBP em vez de SVG.
const SYMBOL_SRC = '/brand/vortice-symbol.svg';
const FULL_SRC = '/brand/vortice-full.svg';

// Símbolo isolado da marca Vórtice. Aponta pra /brand/vortice-symbol.svg.
// Se o arquivo não existir, faz fallback pra o SVG inline antigo (não quebra
// build durante a transição).
export function VorticeLogo({ className, size = 40, decorative = true }: VorticeLogoProps) {
  const [errored, setErrored] = useState(false);

  if (errored) return <FallbackInline className={className} size={size} decorative={decorative} />;

  return (
    <img
      src={SYMBOL_SRC}
      width={size}
      height={size}
      alt={decorative ? '' : 'Logo Vórtice'}
      aria-hidden={decorative ? 'true' : undefined}
      className={cn('shrink-0 object-contain', className)}
      style={{ width: size, height: size }}
      onError={() => setErrored(true)}
    />
  );
}

// Versão completa: símbolo + texto VÓRTICE + tagline. Renderiza
// /brand/vortice-full.svg (proporção horizontal). Se o arquivo ainda não
// estiver salvo no public/, cai pro fallback inline.
export function VorticeWordmark({ size = 36 }: { size?: number }) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="flex items-center gap-3">
        <FallbackInline size={size} decorative />
        <div className="leading-none">
          <p className="font-display text-2xl tracking-[0.15em] text-foreground">
            V<span className="text-vortex-lime">Ó</span>RTICE
          </p>
        </div>
      </div>
    );
  }

  // size é a altura do logotipo; largura segue a proporção natural da imagem.
  return (
    <img
      src={FULL_SRC}
      alt="Vórtice — Estratégia que move eleições."
      style={{ height: size, width: 'auto' }}
      className="shrink-0 object-contain"
      onError={() => setErrored(true)}
    />
  );
}

// ----------------------------------------------------------------------------
// Fallback: o SVG inline antigo. Fica como rede de segurança até o asset
// definitivo aparecer em public/brand/. Visualmente diferente do logo novo,
// então quando aparecer é sinal de que falta salvar o arquivo.
// ----------------------------------------------------------------------------
function FallbackInline({
  className,
  size = 40,
  decorative = true,
}: VorticeLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : 'Logo Vórtice'}
    >
      <defs>
        <linearGradient id="vortex-lime-fallback" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A3E635" />
          <stop offset="100%" stopColor="#65A30D" />
        </linearGradient>
        <linearGradient id="vortex-violet-fallback" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <path
        d="M32 56 C 14 56, 6 42, 14 28 C 22 14, 38 16, 44 28"
        fill="none"
        stroke="url(#vortex-violet-fallback)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M14 32 C 18 16, 36 10, 50 18 C 56 22, 56 32, 50 40"
        fill="none"
        stroke="url(#vortex-lime-fallback)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M44 14 L 52 18 L 48 26"
        fill="none"
        stroke="url(#vortex-lime-fallback)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
