import { useBrand } from '@/hooks/useBrand';
import { VorticeLogo } from './VorticeLogo';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  size?: number;
  className?: string;
  /** Se true, ignora branding da campanha e força o logo Vórtice. */
  forceDefault?: boolean;
}

export function BrandLogo({ size = 40, className, forceDefault }: BrandLogoProps) {
  const { logoUrl, candidateName } = useBrand();

  if (forceDefault || !logoUrl) {
    return <VorticeLogo size={size} className={className} />;
  }

  return (
    <img
      src={logoUrl}
      alt={candidateName ? `Logo ${candidateName}` : 'Logo da campanha'}
      width={size}
      height={size}
      className={cn('object-contain', className)}
      style={{ width: size, height: size }}
    />
  );
}
