'use client';

import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type {
  SaleMethod,
  OfferStatus,
  OfferResponse,
  AuctionResult,
} from '@realflow/shared';

interface OfferRound {
  id: string;
  amount: number;
  conditions: string[];
  response: OfferResponse;
  counterAmount?: number | null;
  notes?: string | null;
  createdAt: string;
}

interface AuctionEvent {
  id: string;
  auctionDate: string;
  registrationNumber?: string | null;
  biddingStrategy?: string | null;
  result?: AuctionResult | null;
  finalPrice?: number | null;
  numberOfBidders?: number | null;
}

interface OfferTrackerProps {
  saleMethod: SaleMethod;
  status: OfferStatus;
  strategyNotes?: string | null;
  rounds: OfferRound[];
  auctionEvent?: AuctionEvent | null;
}

const SALE_METHOD_LABELS: Record<SaleMethod, string> = {
  private_treaty: 'Private Treaty',
  auction: 'Auction',
  eoi: 'Expression of Interest',
  tender: 'Tender',
};

const STATUS_LABELS: Record<OfferStatus, string> = {
  preparing: 'Preparing',
  submitted: 'Submitted',
  countered: 'Countered',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const STATUS_COLORS: Record<OfferStatus, string> = {
  preparing: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  countered: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-200 text-gray-500',
};

const RESPONSE_LABELS: Record<OfferResponse, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  countered: 'Countered',
};

const RESPONSE_COLORS: Record<OfferResponse, string> = {
  pending: 'text-gray-500',
  accepted: 'text-green-600',
  rejected: 'text-red-600',
  countered: 'text-yellow-600',
};

const AUCTION_RESULT_LABELS: Record<AuctionResult, string> = {
  won: 'Won',
  passed_in: 'Passed In',
  outbid: 'Outbid',
};

const AUCTION_RESULT_COLORS: Record<AuctionResult, string> = {
  won: 'bg-green-100 text-green-700',
  passed_in: 'bg-yellow-100 text-yellow-700',
  outbid: 'bg-red-100 text-red-700',
};

export function OfferTracker({
  saleMethod,
  status,
  strategyNotes,
  rounds,
  auctionEvent,
}: OfferTrackerProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Offer Tracker</h3>
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {SALE_METHOD_LABELS[saleMethod]}
            </span>
          </div>
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[status])}>
            {STATUS_LABELS[status]}
          </span>
        </div>
        {strategyNotes && (
          <p className="mt-2 text-xs text-gray-500">{strategyNotes}</p>
        )}
      </div>

      {/* Rounds */}
      {rounds.length > 0 && (
        <div className="border-b border-gray-100 px-6 py-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Offer Rounds
          </h4>
          <div className="space-y-3">
            {rounds.map((round, index) => (
              <div
                key={round.id}
                className="flex items-start justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400">R{index + 1}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(round.amount)}
                    </span>
                  </div>
                  {round.conditions.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {round.conditions.map((condition) => (
                        <span key={condition} className="rounded bg-white px-1.5 py-0.5 text-[10px] text-gray-500 border border-gray-200">
                          {condition}
                        </span>
                      ))}
                    </div>
                  )}
                  {round.counterAmount && (
                    <p className="mt-1 text-xs text-gray-500">
                      Counter: {formatCurrency(round.counterAmount)}
                    </p>
                  )}
                  {round.notes && (
                    <p className="mt-1 text-xs text-gray-400">{round.notes}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn('text-xs font-medium', RESPONSE_COLORS[round.response])}>
                    {RESPONSE_LABELS[round.response]}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {formatDate(round.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auction Details */}
      {auctionEvent && (
        <div className="px-6 py-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Auction Details
          </h4>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900">
                  {formatDate(auctionEvent.auctionDate)}
                </p>
                {auctionEvent.registrationNumber && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    Registration: {auctionEvent.registrationNumber}
                  </p>
                )}
                {auctionEvent.biddingStrategy && (
                  <p className="mt-1 text-xs text-gray-500">
                    Strategy: {auctionEvent.biddingStrategy}
                  </p>
                )}
                {auctionEvent.numberOfBidders != null && (
                  <p className="mt-0.5 text-xs text-gray-400">
                    {auctionEvent.numberOfBidders} bidder{auctionEvent.numberOfBidders !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <div className="text-right">
                {auctionEvent.result && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      AUCTION_RESULT_COLORS[auctionEvent.result],
                    )}
                  >
                    {AUCTION_RESULT_LABELS[auctionEvent.result]}
                  </span>
                )}
                {auctionEvent.finalPrice && (
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {formatCurrency(auctionEvent.finalPrice)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {rounds.length === 0 && !auctionEvent && (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-gray-400">No offer rounds yet.</p>
        </div>
      )}
    </div>
  );
}
