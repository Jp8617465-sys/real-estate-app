'use client';

import { createContext, useContext } from 'react';
import { useProductAccess } from '@/hooks/use-product-access';
import type { ProductType, ProductFeature } from '@realflow/shared';

interface ProductContextValue {
  productAccess: ProductType;
  isLoading: boolean;
  hasFeature: (feature: ProductFeature) => boolean;
}

const ProductContext = createContext<ProductContextValue>({
  productAccess: 'both',
  isLoading: true,
  hasFeature: () => true,
});

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const value = useProductAccess();

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  );
}

export function useProductContext(): ProductContextValue {
  return useContext(ProductContext);
}
