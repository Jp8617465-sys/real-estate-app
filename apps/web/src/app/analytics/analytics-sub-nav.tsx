'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SubNavItem {
  label: string;
  href: string;
}

const SUB_NAV_ITEMS: SubNavItem[] = [
  { label: 'Overview', href: '/analytics' },
  { label: 'Performance', href: '/analytics/performance' },
  { label: 'Revenue', href: '/analytics/revenue' },
  { label: 'Market', href: '/analytics/market' },
];

export function AnalyticsSubNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 border-b border-gray-200" aria-label="Analytics sections">
      <div className="-mb-px flex gap-1 overflow-x-auto">
        {SUB_NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/analytics' ? pathname === '/analytics' : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
