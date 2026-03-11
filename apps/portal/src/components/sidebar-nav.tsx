'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Home,
  GitBranch,
  FolderOpen,
  MessageSquare,
  X,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Brief', href: '/brief', icon: FileText },
  { label: 'Properties', href: '/properties', icon: Home },
  { label: 'Progress', href: '/progress', icon: GitBranch },
  { label: 'Documents', href: '/documents', icon: FolderOpen },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
];

interface SidebarNavProps {
  /** Whether the mobile sidebar overlay is open */
  isOpen: boolean;
  /** Callback to close the mobile sidebar */
  onClose: () => void;
}

export function SidebarNav({ isOpen, onClose }: SidebarNavProps) {
  const pathname = usePathname();

  const navContent = (
    <nav aria-label="Main navigation" className="flex flex-col gap-1 px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={`
              flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500
              ${
                isActive
                  ? 'bg-portal-50 text-portal-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-60 lg:flex-col lg:pt-16">
        <div className="flex grow flex-col overflow-y-auto border-r border-gray-200 bg-white">
          {navContent}
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 bg-gray-900/50"
            onClick={onClose}
            aria-label="Close navigation menu"
          />
          {/* Sidebar panel */}
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-portal-600">
                  <span className="text-sm font-bold text-white">BP</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">BuyerPilot</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
