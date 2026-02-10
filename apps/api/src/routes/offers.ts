import type { FastifyInstance } from 'fastify';
import {
  CreateOfferSchema,
  UpdateOfferSchema,
  CreateOfferRoundSchema,
  CreateAuctionEventSchema,
} from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';

export async function offerRoutes(fastify: FastifyInstance) {
  // List offers (filter by transactionId, clientId)
  fastify.get<{ Querystring: { transactionId?: string; clientId?: string } }>(
    '/',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { transactionId, clientId } = request.query;

      let query = supabase
        .from('offers')
        .select('*')
        .order('updated_at', { ascending: false });

      if (transactionId) {
        query = query.eq('transaction_id', transactionId);
      }

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;
      if (error) return reply.status(500).send({ error: error.message });

      return { data };
    },
  );

  // Get offer with rounds and auction event (join)
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('*')
      .eq('id', id)
      .single();

    if (offerError || !offer) {
      return reply.status(404).send({ error: 'Offer not found' });
    }

    // Fetch rounds
    const { data: rounds } = await supabase
      .from('offer_rounds')
      .select('*')
      .eq('offer_id', id)
      .order('created_at', { ascending: true });

    // Fetch auction event
    const { data: auctionEvent } = await supabase
      .from('auction_events')
      .select('*')
      .eq('offer_id', id)
      .single();

    return {
      data: {
        ...offer,
        rounds: rounds ?? [],
        auctionEvent: auctionEvent ?? null,
      },
    };
  });

  // Create offer
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateOfferSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const offer = parsed.data;

    const { data, error } = await supabase
      .from('offers')
      .insert({
        transaction_id: offer.transactionId,
        property_id: offer.propertyId,
        client_id: offer.clientId,
        sale_method: offer.saleMethod,
        status: offer.status,
        strategy_notes: offer.strategyNotes,
        client_max_price: offer.clientMaxPrice,
        recommended_offer: offer.recommendedOffer,
        walk_away_price: offer.walkAwayPrice,
        conditions: offer.conditions,
        settlement_period: offer.settlementPeriod,
        deposit_amount: offer.depositAmount,
        deposit_type: offer.depositType,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Update offer status/strategy
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateOfferSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.transactionId !== undefined) updatePayload.transaction_id = updates.transactionId;
    if (updates.propertyId !== undefined) updatePayload.property_id = updates.propertyId;
    if (updates.clientId !== undefined) updatePayload.client_id = updates.clientId;
    if (updates.saleMethod !== undefined) updatePayload.sale_method = updates.saleMethod;
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.strategyNotes !== undefined) updatePayload.strategy_notes = updates.strategyNotes;
    if (updates.clientMaxPrice !== undefined) updatePayload.client_max_price = updates.clientMaxPrice;
    if (updates.recommendedOffer !== undefined) updatePayload.recommended_offer = updates.recommendedOffer;
    if (updates.walkAwayPrice !== undefined) updatePayload.walk_away_price = updates.walkAwayPrice;
    if (updates.conditions !== undefined) updatePayload.conditions = updates.conditions;
    if (updates.settlementPeriod !== undefined) updatePayload.settlement_period = updates.settlementPeriod;
    if (updates.depositAmount !== undefined) updatePayload.deposit_amount = updates.depositAmount;
    if (updates.depositType !== undefined) updatePayload.deposit_type = updates.depositType;

    const { data, error } = await supabase
      .from('offers')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // Add offer round
  fastify.post<{ Params: { id: string } }>('/:id/rounds', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = CreateOfferRoundSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const round = parsed.data;

    // Verify offer exists
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('id')
      .eq('id', id)
      .single();

    if (offerError || !offer) {
      return reply.status(404).send({ error: 'Offer not found' });
    }

    const { data, error } = await supabase
      .from('offer_rounds')
      .insert({
        offer_id: id,
        amount: round.amount,
        conditions: round.conditions,
        response: round.response,
        counter_amount: round.counterAmount,
        notes: round.notes,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Create/update auction event
  fastify.post<{ Params: { id: string } }>('/:id/auction', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = CreateAuctionEventSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const auction = parsed.data;

    // Verify offer exists
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('id')
      .eq('id', id)
      .single();

    if (offerError || !offer) {
      return reply.status(404).send({ error: 'Offer not found' });
    }

    // Check if auction event already exists for this offer
    const { data: existing } = await supabase
      .from('auction_events')
      .select('id')
      .eq('offer_id', id)
      .single();

    if (existing) {
      // Update existing auction event
      const { data, error } = await supabase
        .from('auction_events')
        .update({
          auction_date: auction.auctionDate,
          registration_number: auction.registrationNumber,
          bidding_strategy: auction.biddingStrategy,
          result: auction.result,
          final_price: auction.finalPrice,
          number_of_bidders: auction.numberOfBidders,
          updated_at: new Date().toISOString(),
        })
        .eq('offer_id', id)
        .select()
        .single();

      if (error) return reply.status(500).send({ error: error.message });
      return { data };
    }

    // Create new auction event
    const { data, error } = await supabase
      .from('auction_events')
      .insert({
        offer_id: id,
        auction_date: auction.auctionDate,
        registration_number: auction.registrationNumber,
        bidding_strategy: auction.biddingStrategy,
        result: auction.result,
        final_price: auction.finalPrice,
        number_of_bidders: auction.numberOfBidders,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });
}
