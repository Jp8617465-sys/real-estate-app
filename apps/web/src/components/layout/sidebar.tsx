'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-context';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'Contacts', href: '/contacts', icon: '👤' },
  { label: 'Properties', href: '/properties', icon: '🏠' },
  { label: 'Pipeline', href: '/pipeline', icon: '📈' },
  { label: 'Tasks', href: '/tasks', icon: '✅' },
  { label: 'Settings', href: '/settings', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, close } = useSidebar();

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    close();
  }, [pathname, close]);

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out',
          // Hidden on mobile by default, slide in when open
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo & Close Button */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
          <span className="text-2xl font-bold text-gray-900">
            Real<span className="text-brand-600">Flow</span>
          </span>

          {/* Close button (mobile only) */}
          <button
            onClick={close}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                )}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              SM
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-gray-900">Sarah Mitchell</p>
              <p className="text-xs text-gray-500">Principal</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
