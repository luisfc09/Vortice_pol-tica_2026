import { cn } from '@/lib/utils';

interface VorticeLogoProps {
  className?: string;
  size?: number;
  decorative?: boolean;
}

// Vórtice — vortex em duas correntes (lime + violet) com seta ascendente.
// SVG vetorial, escala em qualquer tamanho sem perda.
export function VorticeLogo({ className, size = 40, decorative = true }: VorticeLogoProps) {
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
        <linearGradient id="vortex-lime" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A3E635" />
          <stop offset="100%" stopColor="#65A30D" />
        </linearGradient>
        <linearGradient id="vortex-violet" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>

      {/* Vortex inferior — violet */}
      <path
        d="M32 56 C 14 56, 6 42, 14 28 C 22 14, 38 16, 44 28"
        fill="none"
        stroke="url(#vortex-violet)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Vortex superior — lime com seta */}
      <path
        d="M14 32 C 18 16, 36 10, 50 18 C 56 22, 56 32, 50 40"
        fill="none"
        stroke="url(#vortex-lime)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M44 14 L 52 18 L 48 26"
        fill="none"
        stroke="url(#vortex-lime)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Versão compacta com palavra "VÓRTICE" ao lado, usada na sidebar e login.
export function VorticeWordmark({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <VorticeLogo size={size} />
      <div className="leading-none">
        <p className="font-display text-2xl tracking-[0.15em] text-foreground">
          V<span className="text-vortex-lime">Ó</span>RTICE
        </p>
      </div>
    </div>
  );
}
