'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-context';
import { useTheme } from '@/lib/theme-context';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: '📊' },
      { label: 'Inbox', href: '/inbox', icon: '💬' },
      { label: 'Contacts', href: '/contacts', icon: '👤' },
      { label: 'Properties', href: '/properties', icon: '🏠' },
      { label: 'Pipeline', href: '/pipeline', icon: '📈' },
      { label: 'Tasks', href: '/tasks', icon: '✅' },
      { label: 'Today', href: '/daily-actions', icon: '⭐' },
      { label: 'Workflows', href: '/workflows', icon: '⚡' },
      { label: 'Sequences', href: '/workflows/sequences', icon: '🔄' },
      { label: 'Social', href: '/social', icon: '📱' },
      { label: 'Analytics', href: '/analytics', icon: '📉' },
      { label: 'Alerts', href: '/alerts', icon: '🔔' },
    ],
  },
  {
    title: 'Buyers Agent',
    items: [
      { label: 'BA Dashboard', href: '/buyers-agent', icon: '🏡' },
      { label: 'Client Briefs', href: '/buyers-agent/briefs', icon: '📋' },
      { label: 'Property Matches', href: '/buyers-agent/matches', icon: '🎯' },
      { label: 'Due Diligence', href: '/buyers-agent/due-diligence', icon: '🔍' },
      { label: 'Selling Agents', href: '/buyers-agent/selling-agents', icon: '🤝' },
    ],
  },
  {
    items: [{ label: 'Settings', href: '/settings', icon: '⚙️' }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, close } = useSidebar();
  const { darkMode, setDarkMode } = useTheme();

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
          'dark:border-gray-700 dark:bg-gray-900',
          // Hidden on mobile by default, slide in when open
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo & Close Button */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6 dark:border-gray-700">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            Real<span className="text-brand-600">Flow</span>
          </span>

          {/* Close button (mobile only) */}
          <button
            onClick={close}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navSections.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              {section.title && (
                <p className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const isExactActive = pathname === item.href;
                const isParentActive = !isExactActive && pathname.startsWith(item.href);
                const active = isExactActive || isParentActive;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
                    )}
                  >
                    <span className="text-lg">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom section: dark mode toggle + user info */}
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          {/* Dark mode toggle — Light / System / Dark */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Theme</span>
            <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
              <button
                onClick={() => setDarkMode('light')}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  darkMode === 'light'
                    ? 'bg-white shadow-sm text-gray-900 dark:bg-gray-700 dark:text-white'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                )}
                aria-label="Light mode"
                aria-pressed={darkMode === 'light'}
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDarkMode('system')}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  darkMode === 'system'
                    ? 'bg-white shadow-sm text-gray-900 dark:bg-gray-700 dark:text-white'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                )}
                aria-label="System mode"
                aria-pressed={darkMode === 'system'}
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDarkMode('dark')}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  darkMode === 'dark'
                    ? 'bg-white shadow-sm text-gray-900 dark:bg-gray-700 dark:text-white'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                )}
                aria-label="Dark mode"
                aria-pressed={darkMode === 'dark'}
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              SM
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Sarah Mitchell</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Principal</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
