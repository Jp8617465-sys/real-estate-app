import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CreateOffer, CreateOfferRound } from '@realflow/shared';

const supabase = createClient();

export function useOffers(transactionId?: string) {
  return useQuery({
    queryKey: ['offers', transactionId],
    queryFn: async () => {
      let query = supabase
        .from('offers')
        .select(`
          *,
          rounds:offer_rounds(*),
          auction_event:auction_events(*)
        `)
        .order('updated_at', { ascending: false });

      if (transactionId) {
        query = query.eq('transaction_id', transactionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useOffer(id: string) {
  return useQuery({
    queryKey: ['offers', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offers')
        .select(`
          *,
          rounds:offer_rounds(*),
          auction_event:auction_events(*),
          property:properties(id, address_street_number, address_street_name, address_suburb),
          client:contacts(id, first_name, last_name)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
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
      return data;
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
          offer_id: offerId,
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
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      queryClient.invalidateQueries({ queryKey: ['offers', offerId] });
    },
  });
}
