import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import defaults from '../../brand.config.json';
import { createSetting } from './firebase';

export type Brand = typeof defaults;

export const brandDb = createSetting<Brand>('branding', defaults);

const BrandContext = createContext<Brand>(defaults);

export const useBrand = () => useContext(BrandContext);

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState(brandDb.get);

  useEffect(() => brandDb.subscribe(setBrand), []);

  useEffect(() => {
    document.title = brand.name;
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.href = brand.logoUrl || 'data:,';
  }, [brand]);

  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export const fillTemplate = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, v), template);
