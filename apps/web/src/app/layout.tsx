export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { ErrorBoundary } from '@/components/error-boundary';

export const metadata: Metadata = {
  title: 'RealFlow — Real Estate CRM',
  description:
    'The frictionless CRM and workflow platform for Australian real estate agents and buyers agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* FOUC prevention: apply dark class synchronously before first paint */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=localStorage.getItem('realflow-dark');if(d==='dark'||(d==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased transition-colors duration-200">
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
