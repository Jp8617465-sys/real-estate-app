'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { ProductType, ProductFeature } from '@realflow/shared';
import { isFeatureAvailable } from '@realflow/shared';

const supabase = createClient();

interface ProductAccessResult {
  productAccess: ProductType;
  isLoading: boolean;
  hasFeature: (feature: ProductFeature) => boolean;
}

async function fetchProductAccess(): Promise<ProductType> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'both';

  const { data } = await supabase
    .from('users')
    .select('product_access, office_id')
    .eq('auth_id', user.id)
    .single();

  if (!data) return 'both';

  const userAccess = data.product_access as ProductType | null;
  if (userAccess) return userAccess;

  // Fall back to office product_type
  if (data.office_id) {
    const { data: office } = await supabase
      .from('offices')
      .select('product_type')
      .eq('id', data.office_id)
      .single();

    const officeAccess = office?.product_type as ProductType | null;
    if (officeAccess) return officeAccess;
  }

  return 'both';
}

export function useProductAccess(): ProductAccessResult {
  const { data: productAccess, isLoading } = useQuery({
    queryKey: ['product-access'],
    queryFn: fetchProductAccess,
    staleTime: 5 * 60 * 1000, // 5 minutes — product access rarely changes
  });

  const resolvedAccess: ProductType = productAccess ?? 'both';

  return {
    productAccess: resolvedAccess,
    isLoading,
    hasFeature: (feature: ProductFeature) =>
      isFeatureAvailable(feature, resolvedAccess),
  };
}
