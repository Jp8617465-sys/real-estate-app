import type { FastifyRequest, FastifyReply } from 'fastify';
import { isFeatureAvailable } from '@realflow/shared';
import type { ProductFeature, ProductType } from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';

/**
 * Creates a Fastify preHandler hook that gates access based on product type.
 *
 * Usage in a route file:
 *   fastify.addHook('preHandler', productGuardHook('client_briefs'));
 */
export function productGuardHook(feature: ProductFeature) {
  return async function guard(request: FastifyRequest, reply: FastifyReply) {
    let supabase;
    try {
      supabase = createSupabaseClient(request);
    } catch {
      return reply.code(401).send({ error: 'Unauthorized', success: false });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized', success: false });
    }

    // Look up user's product_access with office fallback
    const { data: userData } = await supabase
      .from('users')
      .select('product_access, office_id')
      .eq('auth_id', user.id)
      .single();

    let productAccess: ProductType = 'both';

    if (userData) {
      if (userData.product_access) {
        productAccess = userData.product_access as ProductType;
      } else if (userData.office_id) {
        const { data: office } = await supabase
          .from('offices')
          .select('product_type')
          .eq('id', userData.office_id)
          .single();

        if (office?.product_type) {
          productAccess = office.product_type as ProductType;
        }
      }
    }

    if (!isFeatureAvailable(feature, productAccess)) {
      return reply.code(403).send({
        error: 'Feature not available for your product access level',
        success: false,
      });
    }

    // Cache on request for downstream handlers
    (request as FastifyRequest & { productAccess?: ProductType }).productAccess = productAccess;
  };
}
