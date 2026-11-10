import { useBrand } from '../lib/brand';

export function BrandLogo({ size = 48, className = '' }: { size?: number; className?: string }) {
  const brand = useBrand();
  const initials = brand.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return brand.logoUrl ? (
    <img src={brand.logoUrl} alt={brand.name} width={size} height={size} className={`rounded-full object-cover ${className}`} style={{ width: size, height: size }} />
  ) : (
    <div
      className={`rounded-full bg-slate-900 text-white font-black flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}
