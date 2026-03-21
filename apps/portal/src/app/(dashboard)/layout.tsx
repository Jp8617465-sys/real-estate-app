'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { SidebarNav } from '@/components/sidebar-nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <SidebarNav isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile menu button - fixed to bottom right for easy thumb reach */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-portal-600 text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500 focus-visible:ring-offset-2 lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Main content area */}
      <div className="lg:pl-60">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
