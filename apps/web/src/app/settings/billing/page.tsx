'use client';

import { useState } from 'react';
import {
  useSubscriptionPlans,
  useCurrentSubscription,
  useCreateCheckout,
  useUpdateSubscription,
  useBillingPortal,
  usePaymentHistory,
} from '@/hooks/use-subscriptions';

export default function BillingPage() {
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: subscription } = useCurrentSubscription();
  const { data: payments, isLoading: paymentsLoading } = usePaymentHistory();
  const createCheckout = useCreateCheckout();
  const updateSubscription = useUpdateSubscription();
  const billingPortal = useBillingPortal();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  const handleSelectPlan = (planId: string) => {
    createCheckout.mutate(
      { planId, billingInterval, seatCount: 1 },
      {
        onSuccess: (data) => {
          window.location.href = (data as { checkoutUrl: string }).checkoutUrl;
        },
      },
    );
  };

  const handleManageBilling = () => {
    billingPortal.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = (data as { portalUrl: string }).portalUrl;
      },
    });
  };

  const handleCancelSubscription = () => {
    updateSubscription.mutate({ cancelAtPeriodEnd: true });
  };

  const handleReactivate = () => {
    updateSubscription.mutate({ cancelAtPeriodEnd: false });
  };

  const currentSub = subscription as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Billing & Subscription</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your plan, payment method, and invoices</p>
      </div>

      {/* Current Subscription */}
      {currentSub && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Current Plan</h2>
              <p className="text-2xl font-bold text-brand-600 mt-1">
                {(currentSub.plan as Record<string, unknown>)?.name as string ?? currentSub.plan_id as string}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {currentSub.status === 'trialing' && 'Free trial'}
                {currentSub.status === 'active' && 'Active'}
                {currentSub.status === 'past_due' && 'Payment overdue'}
                {currentSub.status === 'canceled' && 'Canceled'}
                {' '}· {currentSub.seat_count as number} seat{(currentSub.seat_count as number) > 1 ? 's' : ''}
                {' '}· {currentSub.billing_interval as string}
              </p>
              {Boolean(currentSub.cancel_at_period_end) && (
                <p className="text-sm text-red-600 mt-2">
                  Cancels at end of period ({new Date(currentSub.current_period_end as string).toLocaleDateString('en-AU')})
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleManageBilling}
                disabled={billingPortal.isPending}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              >
                Manage Payment Method
              </button>
              {currentSub.cancel_at_period_end ? (
                <button
                  onClick={handleReactivate}
                  disabled={updateSubscription.isPending}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Reactivate
                </button>
              ) : (
                <button
                  onClick={handleCancelSubscription}
                  disabled={updateSubscription.isPending}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Cancel Plan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pricing Plans */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {currentSub ? 'Change Plan' : 'Choose a Plan'}
          </h2>
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${billingInterval === 'monthly' ? 'bg-white shadow-sm text-gray-900 dark:bg-gray-600 dark:text-white' : 'text-gray-500'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${billingInterval === 'yearly' ? 'bg-white shadow-sm text-gray-900 dark:bg-gray-600 dark:text-white' : 'text-gray-500'}`}
            >
              Yearly (Save 20%)
            </button>
          </div>
        </div>

        {plansLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-80 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(plans as Array<Record<string, unknown>> ?? []).map((plan) => {
              const price = billingInterval === 'yearly'
                ? plan.priceYearlyAud as number
                : plan.priceMonthlyAud as number;
              const isCurrentPlan = currentSub?.plan_id === plan.id;
              const isEnterprise = plan.id === 'enterprise';

              return (
                <div
                  key={plan.id as string}
                  className={`rounded-xl border p-6 ${isCurrentPlan ? 'border-brand-500 ring-2 ring-brand-200' : 'border-gray-200 dark:border-gray-700'} bg-white shadow-sm dark:bg-gray-800`}
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{plan.name as string}</h3>
                  <div className="mt-2">
                    {isEnterprise ? (
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">Custom</p>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                          ${billingInterval === 'yearly' ? Math.round(price / 12) : price}
                        </span>
                        <span className="text-sm text-gray-500">/mo</span>
                        {billingInterval === 'yearly' && (
                          <p className="text-xs text-gray-500 mt-1">
                            ${price}/year (billed annually)
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">Up to {plan.maxSeats as number} seat{(plan.maxSeats as number) > 1 ? 's' : ''}</p>
                  <ul className="mt-4 space-y-2">
                    {(plan.features as string[]).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <span className="mt-0.5 text-green-500">&#10003;</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => !isEnterprise && handleSelectPlan(plan.id as string)}
                    disabled={isCurrentPlan || createCheckout.isPending}
                    className={`mt-6 w-full rounded-lg px-4 py-2 text-sm font-medium ${
                      isCurrentPlan
                        ? 'bg-gray-100 text-gray-500 cursor-default dark:bg-gray-700'
                        : isEnterprise
                          ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
                          : 'bg-brand-600 text-white hover:bg-brand-700'
                    }`}
                  >
                    {isCurrentPlan ? 'Current Plan' : isEnterprise ? 'Contact Sales' : 'Select Plan'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Payment History</h2>
        {paymentsLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-10 rounded bg-gray-100 dark:bg-gray-700" />)}
          </div>
        ) : (payments as Array<Record<string, unknown>> ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">No payments yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 text-left font-medium text-gray-500">Date</th>
                <th className="pb-2 text-left font-medium text-gray-500">Amount</th>
                <th className="pb-2 text-left font-medium text-gray-500">GST</th>
                <th className="pb-2 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {(payments as Array<Record<string, unknown>> ?? []).map((payment) => (
                <tr key={payment.id as string} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 text-gray-900 dark:text-gray-100">
                    {new Date(payment.created_at as string).toLocaleDateString('en-AU')}
                  </td>
                  <td className="py-2 text-gray-900 dark:text-gray-100">${payment.amount_aud as number}</td>
                  <td className="py-2 text-gray-500">${payment.gst_amount_aud as number}</td>
                  <td className="py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      payment.status === 'succeeded' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      payment.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {payment.status as string}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
