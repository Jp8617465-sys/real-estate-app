import crypto from 'node:crypto';
import { PassThrough } from 'node:stream';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DomainClient } from '@realflow/integrations';
import { PropertySyncService } from '@realflow/integrations/domain/sync-service';
import { DomainWebhookEventSchema } from '@realflow/integrations/domain/types';
import { PropertyMatchEngine } from '@realflow/business-logic';
import { createSupabaseServiceClient } from '../middleware/supabase';
import { env } from '../config/env';

// ─── Webhook Signature Validation ───────────────────────────────────────────

/**
 * Verify Domain.com.au webhook HMAC-SHA256 signature.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!secret || !signature) return false;

  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');

    return (
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    );
  } catch {
    return false;
  }
}

// ─── Notification Schema ────────────────────────────────────────────────────

const AgentNotificationSchema = z.object({
  agentId: z.string().uuid(),
  propertyId: z.string().uuid(),
  briefId: z.string().uuid(),
  clientId: z.string().uuid(),
  matchScore: z.number().int().min(0).max(100),
  notificationType: z.literal('new_listing_match'),
});

type AgentNotification = z.infer<typeof AgentNotificationSchema>;

// ─── Domain Webhook Routes ──────────────────────────────────────────────────

export async function domainWebhookRoutes(fastify: FastifyInstance) {
  // Capture raw request body for HMAC validation
  fastify.addHook('preParsing', (_req, _reply, payload, done) => {
    const chunks: Buffer[] = [];
    const pt = new PassThrough();
    payload.on('data', (chunk: unknown) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      chunks.push(buf);
      pt.push(buf);
    });
    payload.on('end', () => {
      (_req as FastifyRequest & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
      pt.push(null);
    });
    payload.on('error', (err) => pt.destroy(err));
    done(null, pt);
  });

  // ─── POST /api/webhooks/domain/listing-alert ────────────────────────────────

  /**
   * Receives new listing alert notifications from Domain.com.au.
   *
   * Flow:
   * 1. Validate webhook signature (HMAC-SHA256)
   * 2. Parse and validate the event payload
   * 3. Map listing data to RealFlow property schema
   * 4. Create/update property record
   * 5. Match against all active client briefs
   * 6. Notify agents of matching properties
   *
   * Returns 200 immediately; heavy processing is async.
   */
  fastify.post('/listing-alert', async (request, reply) => {
    const signature = request.headers['x-domain-signature'];
    const webhookSecret = env.DOMAIN_WEBHOOK_SECRET ?? '';

    if (!signature || typeof signature !== 'string') {
      return reply.status(401).send({ error: 'Missing webhook signature' });
    }

    const rawBody =
      (request as FastifyRequest & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(request.body));

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      fastify.log.warn('[domain-webhook] Invalid signature on listing-alert');
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    // Validate event payload
    const eventParse = DomainWebhookEventSchema.safeParse(request.body);
    if (!eventParse.success) {
      fastify.log.warn(
        { errors: eventParse.error.flatten() },
        '[domain-webhook] Invalid event payload',
      );
      return reply.status(400).send({
        error: 'Invalid event payload',
        details: eventParse.error.flatten().fieldErrors,
      });
    }

    const event = eventParse.data;

    fastify.log.info(
      { type: event.type, listingId: event.listingId },
      '[domain-webhook] Received listing alert',
    );

    // Process asynchronously so we return 200 quickly
    setImmediate(() => {
      void processListingAlert(event, fastify).catch((err) => {
        fastify.log.error(
          `[domain-webhook] Processing error: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    });

    return reply.status(200).send({ received: true });
  });

  // ─── POST /api/webhooks/domain/price-update ─────────────────────────────────

  /**
   * Receives price update notifications from Domain.com.au.
   *
   * Detects price changes and notifies agents whose clients
   * are tracking properties with matching criteria.
   */
  fastify.post('/price-update', async (request, reply) => {
    const signature = request.headers['x-domain-signature'];
    const webhookSecret = env.DOMAIN_WEBHOOK_SECRET ?? '';

    if (!signature || typeof signature !== 'string') {
      return reply.status(401).send({ error: 'Missing webhook signature' });
    }

    const rawBody =
      (request as FastifyRequest & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(request.body));

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    const eventParse = DomainWebhookEventSchema.safeParse(request.body);
    if (!eventParse.success) {
      return reply.status(400).send({ error: 'Invalid event payload' });
    }

    const event = eventParse.data;

    fastify.log.info(
      { type: event.type, listingId: event.listingId },
      '[domain-webhook] Received price update',
    );

    setImmediate(() => {
      void processPriceUpdate(event, fastify).catch((err) => {
        fastify.log.error(
          `[domain-webhook] Price update error: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    });

    return reply.status(200).send({ received: true });
  });

  // ─── POST /api/webhooks/domain/status-change ────────────────────────────────

  /**
   * Receives listing status change notifications from Domain.com.au.
   *
   * Handles transitions like:
   * - listed -> under offer
   * - under offer -> sold
   * - listed -> withdrawn
   */
  fastify.post('/status-change', async (request, reply) => {
    const signature = request.headers['x-domain-signature'];
    const webhookSecret = env.DOMAIN_WEBHOOK_SECRET ?? '';

    if (!signature || typeof signature !== 'string') {
      return reply.status(401).send({ error: 'Missing webhook signature' });
    }

    const rawBody =
      (request as FastifyRequest & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(request.body));

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    const eventParse = DomainWebhookEventSchema.safeParse(request.body);
    if (!eventParse.success) {
      return reply.status(400).send({ error: 'Invalid event payload' });
    }

    const event = eventParse.data;

    fastify.log.info(
      {
        type: event.type,
        listingId: event.listingId,
        previousStatus: event.previousStatus,
        newStatus: event.newStatus,
      },
      '[domain-webhook] Received status change',
    );

    setImmediate(() => {
      void processStatusChange(event, fastify).catch((err) => {
        fastify.log.error(
          `[domain-webhook] Status change error: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    });

    return reply.status(200).send({ received: true });
  });
}

// ─── Async Processing Functions ─────────────────────────────────────────────

async function processListingAlert(
  event: z.infer<typeof DomainWebhookEventSchema>,
  fastify: FastifyInstance,
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const listingId = event.listingId;

  if (!listingId && !event.listing) {
    fastify.log.warn('[domain-webhook] No listing ID or listing data in event');
    return;
  }

  // Create sync service to map the listing
  const domainClient = new DomainClient({
    clientId: env.DOMAIN_CLIENT_ID ?? '',
    clientSecret: env.DOMAIN_CLIENT_SECRET ?? '',
  });
  const syncService = new PropertySyncService(domainClient);

  // Get listing data either from event payload or by fetching from Domain
  let mapped;
  if (event.listing) {
    mapped = syncService.mapListing(event.listing);
  } else if (listingId) {
    const { property } = await syncService.syncSingleListing(listingId);
    mapped = property;
  } else {
    return;
  }

  // Upsert property into database
  const { data: upsertedProperty, error: upsertError } = await supabase
    .from('properties')
    .upsert(
      {
        domain_listing_id: mapped.domainListingId,
        address_street_number: mapped.addressStreetNumber,
        address_street: mapped.addressStreet,
        address_suburb: mapped.addressSuburb,
        address_state: mapped.addressState,
        address_postcode: mapped.addressPostcode,
        address_country: mapped.addressCountry,
        property_type: mapped.propertyType,
        bedrooms: mapped.bedrooms,
        bathrooms: mapped.bathrooms,
        car_spaces: mapped.carSpaces,
        land_size: mapped.landSize,
        building_size: mapped.buildingSize,
        year_built: mapped.yearBuilt,
        list_price: mapped.listPrice,
        price_guide: mapped.priceGuide,
        listing_status: mapped.listingStatus === 'active' ? 'for-sale' : mapped.listingStatus,
        sale_type: mapped.saleType,
        auction_date: mapped.auctionDate,
        listing_description: mapped.listingDescription,
        photos: JSON.stringify(mapped.photos),
        floor_plans: JSON.stringify(mapped.floorPlans),
        virtual_tour_url: mapped.virtualTourUrl,
        features: JSON.stringify(mapped.features),
        is_deleted: false,
      },
      { onConflict: 'domain_listing_id' },
    )
    .select('id, assigned_agent_id')
    .single();

  if (upsertError) {
    fastify.log.error(
      `[domain-webhook] Upsert error: ${upsertError.message}`,
    );
    return;
  }

  if (!upsertedProperty) return;

  const propertyId = (upsertedProperty as { id: string }).id;

  // Match against all active client briefs
  await matchPropertyAgainstBriefs(propertyId, mapped, supabase, fastify);
}

async function processPriceUpdate(
  event: z.infer<typeof DomainWebhookEventSchema>,
  fastify: FastifyInstance,
): Promise<void> {
  if (!event.listingId) return;

  const supabase = createSupabaseServiceClient();

  // Find the property in our database
  const { data: property, error } = await supabase
    .from('properties')
    .select('id, list_price, assigned_agent_id, domain_listing_id')
    .eq('domain_listing_id', event.listingId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (error || !property) {
    fastify.log.info(
      `[domain-webhook] Property not found for listing ${event.listingId}`,
    );
    return;
  }

  const typedProperty = property as {
    id: string;
    list_price: number | null;
    assigned_agent_id: string;
    domain_listing_id: string;
  };

  const newPrice = event.newPrice ?? null;
  const previousPrice = typedProperty.list_price;

  if (newPrice === null || newPrice === previousPrice) return;

  // Update the property price
  await supabase
    .from('properties')
    .update({ list_price: newPrice })
    .eq('id', typedProperty.id);

  // Record the price change
  const changePercent = previousPrice
    ? Math.round(((newPrice - previousPrice) / previousPrice) * 10000) / 100
    : null;
  const changeType: string = previousPrice === null
    ? 'price_guide_set'
    : newPrice < previousPrice
      ? 'reduction'
      : 'increase';

  await supabase
    .from('property_price_changes')
    .insert({
      property_id: typedProperty.id,
      domain_listing_id: typedProperty.domain_listing_id,
      previous_price: previousPrice,
      new_price: newPrice,
      change_percent: changePercent,
      change_type: changeType,
      notified_agent_ids: [],
    });

  fastify.log.info(
    `[domain-webhook] Price ${changeType} recorded for listing ${event.listingId}: ${previousPrice ?? 'null'} -> ${newPrice}`,
  );
}

async function processStatusChange(
  event: z.infer<typeof DomainWebhookEventSchema>,
  fastify: FastifyInstance,
): Promise<void> {
  if (!event.listingId || !event.newStatus) return;

  const supabase = createSupabaseServiceClient();

  // Map Domain status to RealFlow status
  const statusMap: Record<string, string> = {
    live: 'for-sale',
    underOffer: 'under-offer',
    sold: 'sold',
    withdrawn: 'withdrawn',
    leased: 'leased',
    deposit: 'under-offer',
  };

  const mappedStatus = statusMap[event.newStatus] ?? 'active';

  // Update the property status
  const { error } = await supabase
    .from('properties')
    .update({ listing_status: mappedStatus })
    .eq('domain_listing_id', event.listingId)
    .eq('is_deleted', false);

  if (error) {
    fastify.log.error(
      `[domain-webhook] Status update error: ${error.message}`,
    );
    return;
  }

  fastify.log.info(
    `[domain-webhook] Status change for listing ${event.listingId}: ${event.previousStatus ?? 'unknown'} -> ${event.newStatus} (mapped: ${mappedStatus})`,
  );
}

// ─── Property Brief Matching ────────────────────────────────────────────────

async function matchPropertyAgainstBriefs(
  propertyId: string,
  mapped: {
    addressSuburb: string;
    addressState: string;
    addressPostcode: string;
    propertyType: string;
    bedrooms: number;
    bathrooms: number;
    carSpaces: number;
    listPrice: number | null;
    landSize: number | null;
  },
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  fastify: FastifyInstance,
): Promise<void> {
  // Fetch all active client briefs that could potentially match
  const { data: briefs, error: briefsError } = await supabase
    .from('client_briefs')
    .select('id, contact_id, created_by, budget_min, budget_max, bedrooms_min, property_types, suburbs')
    .eq('is_deleted', false);

  if (briefsError || !briefs || briefs.length === 0) return;

  const notifications: AgentNotification[] = [];

  for (const brief of briefs as Array<{
    id: string;
    contact_id: string;
    created_by: string;
    budget_min: number;
    budget_max: number;
    bedrooms_min: number | null;
    property_types: string[] | null;
    suburbs: Array<{ suburb: string; state?: string; postcode?: string }>;
  }>) {
    // Quick pre-filter: check suburb match
    const suburbs = Array.isArray(brief.suburbs) ? brief.suburbs : [];
    const suburbMatch = suburbs.length === 0 || suburbs.some(
      (s) => s.suburb.toLowerCase() === mapped.addressSuburb.toLowerCase(),
    );
    if (!suburbMatch) continue;

    // Quick pre-filter: check price range
    if (mapped.listPrice !== null) {
      if (mapped.listPrice > brief.budget_max * 1.2) continue;
      if (mapped.listPrice < brief.budget_min * 0.5) continue;
    }

    // Quick pre-filter: check bedrooms
    if (brief.bedrooms_min !== null && mapped.bedrooms < brief.bedrooms_min - 1) continue;

    // Quick pre-filter: check property type
    const propertyTypes = brief.property_types ?? [];
    if (propertyTypes.length > 0 && !propertyTypes.includes(mapped.propertyType)) continue;

    // Compute a lightweight match score
    let score = 50; // Base score

    // Price scoring (simplified from PropertyMatchEngine)
    if (mapped.listPrice !== null) {
      if (mapped.listPrice >= brief.budget_min && mapped.listPrice <= brief.budget_max) {
        score += 25;
      } else if (mapped.listPrice > brief.budget_max) {
        score += Math.max(0, 15 - Math.round(((mapped.listPrice - brief.budget_max) / brief.budget_max) * 100));
      } else {
        score += 15;
      }
    }

    // Suburb exact match
    if (suburbMatch && suburbs.length > 0) {
      score += 15;
    }

    // Bedrooms match
    if (brief.bedrooms_min !== null && mapped.bedrooms >= brief.bedrooms_min) {
      score += 10;
    }

    // Clamp score to 0-100
    score = Math.min(100, Math.max(0, score));

    // Check if match already exists
    const { data: existingMatch } = await supabase
      .from('property_matches')
      .select('id')
      .eq('property_id', propertyId)
      .eq('brief_id', brief.id)
      .maybeSingle();

    if (existingMatch) continue; // Already matched

    // Create property match
    const { error: matchError } = await supabase
      .from('property_matches')
      .insert({
        property_id: propertyId,
        brief_id: brief.id,
        status: 'new',
        overall_score: score,
        score_breakdown: JSON.stringify({
          priceMatch: mapped.listPrice !== null ? (mapped.listPrice >= brief.budget_min && mapped.listPrice <= brief.budget_max ? 100 : 50) : 50,
          locationMatch: suburbMatch ? 100 : 0,
          sizeMatch: brief.bedrooms_min !== null && mapped.bedrooms >= brief.bedrooms_min ? 100 : 50,
          featureMatch: 50,
        }),
        flags: JSON.stringify([]),
        is_deleted: false,
      });

    if (!matchError && score >= 40) {
      notifications.push({
        agentId: brief.created_by,
        propertyId,
        briefId: brief.id,
        clientId: brief.contact_id,
        matchScore: score,
        notificationType: 'new_listing_match',
      });
    }
  }

  // Send notifications to agents
  for (const notification of notifications) {
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: notification.agentId,
          type: 'new_listing_match',
          title: 'New listing matches client brief',
          body: `A new listing scored ${notification.matchScore}/100 against a client brief`,
          data: JSON.stringify({
            propertyId: notification.propertyId,
            briefId: notification.briefId,
            clientId: notification.clientId,
            matchScore: notification.matchScore,
          }),
          read: false,
        });
    } catch (err) {
      fastify.log.error(
        `[domain-webhook] Notification error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (notifications.length > 0) {
    fastify.log.info(
      `[domain-webhook] Sent ${notifications.length} match notifications for property ${propertyId}`,
    );
  }
}
