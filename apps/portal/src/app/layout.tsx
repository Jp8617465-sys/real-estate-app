import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PortalNav } from '@/components/portal-nav';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'BuyerPilot - Client Portal',
  description:
    'View your property search progress, shortlisted properties, due diligence, and key dates.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans antialiased">
        <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-portal-600">
                  <span className="text-sm font-bold text-white">BP</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">BuyerPilot</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 sm:flex">
                  <div className="h-8 w-8 rounded-full bg-portal-100 flex items-center justify-center">
                    <span className="text-xs font-medium text-portal-700">SJ</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Sarah Johnson</span>
                </div>
              </div>
            </div>
          </div>
          <PortalNav />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
