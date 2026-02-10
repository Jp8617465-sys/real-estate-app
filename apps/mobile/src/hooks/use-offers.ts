import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Offer, CreateOffer, CreateOfferRound, AuctionResult } from '@realflow/shared';

export function useOffer(offerId: string) {
  return useQuery({
    queryKey: ['offers', offerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offers')
        .select('*, rounds:offer_rounds(*), auction_event:auction_events(*)')
        .eq('id', offerId)
        .single();
      if (error) throw error;
      return data as Offer;
    },
    enabled: !!offerId,
  });
}

export function useOffers(clientId?: string) {
  return useQuery({
    queryKey: ['offers', { clientId }],
    queryFn: async () => {
      let query = supabase
        .from('offers')
        .select('*, rounds:offer_rounds(*)')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Offer[];
    },
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (offer: CreateOffer) => {
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
      if (error) throw error;
      return data as Offer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
  });
}

export function useAddOfferRound(offerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (round: CreateOfferRound) => {
      const { data, error } = await supabase
        .from('offer_rounds')
        .insert({
          offer_id: round.offerId,
          amount: round.amount,
          conditions: round.conditions,
          response: round.response,
          counter_amount: round.counterAmount,
          notes: round.notes,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers', offerId] });
    },
  });
}

export function useUpdateAuctionResult(offerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      result,
      finalPrice,
      numberOfBidders,
    }: {
      result: AuctionResult;
      finalPrice?: number;
      numberOfBidders?: number;
    }) => {
      const { data, error } = await supabase
        .from('auction_events')
        .update({
          result,
          final_price: finalPrice,
          number_of_bidders: numberOfBidders,
        })
        .eq('offer_id', offerId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers', offerId] });
    },
  });
}
