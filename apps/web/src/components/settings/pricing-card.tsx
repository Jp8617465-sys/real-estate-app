'use client';

interface PricingCardProps {
  name: string;
  price: string;
  description: string;
  features: string[];
  isCurrentTier: boolean;
  isRecommended?: boolean;
  onSelect: () => void;
  isLoading?: boolean;
}

export function PricingCard({
  name,
  price,
  description,
  features,
  isCurrentTier,
  isRecommended = false,
  onSelect,
  isLoading = false,
}: PricingCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border p-6 ${
        isRecommended
          ? 'border-brand-500 shadow-md ring-1 ring-brand-500'
          : 'border-gray-200 dark:border-gray-700'
      } bg-white dark:bg-gray-800`}
    >
      {isRecommended && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-medium text-white">
          Recommended
        </span>
      )}

      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{name}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>

      <div className="mt-4">
        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{price}</span>
        {price !== 'Free' && (
          <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
        )}
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        disabled={isCurrentTier || isLoading}
        className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium ${
          isCurrentTier
            ? 'cursor-default border border-gray-300 bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400'
            : isRecommended
              ? 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50'
              : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        {isCurrentTier ? 'Current Plan' : isLoading ? 'Loading...' : 'Select Plan'}
      </button>
    </div>
  );
}
