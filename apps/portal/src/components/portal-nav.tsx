'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Home,
  ClipboardCheck,
  Calendar,
  FolderOpen,
  MessageSquare,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'My Brief', href: '/brief', icon: FileText },
  { label: 'Properties', href: '/properties', icon: Home },
  { label: 'Due Diligence', href: '/due-diligence', icon: ClipboardCheck },
  { label: 'Timeline', href: '/timeline', icon: Calendar },
  { label: 'Documents', href: '/documents', icon: FolderOpen },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="border-t border-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mb-px flex gap-1 overflow-x-auto scrollbar-none">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5
                  text-sm font-medium transition-colors
                  ${
                    isActive
                      ? 'border-portal-600 text-portal-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
