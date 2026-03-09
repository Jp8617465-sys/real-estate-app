'use client';

import * as RadixToast from '@radix-ui/react-toast';
import { useContext } from 'react';
import { ToastContext, ToastContextProvider } from '@/contexts/toast-context';
import { ToastItem } from './toast';

function ToastRenderer() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;
  return (
    <RadixToast.Provider swipeDirection="right">
      {ctx.toasts.map((t) => (
        <ToastItem
          key={t.id}
          id={t.id}
          message={t.message}
          variant={t.variant}
          open={t.open}
          duration={t.duration}
          actionLabel={t.actionLabel}
          onAction={t.onAction}
          onOpenChange={(open) => ctx.setToastOpen(t.id, open)}
        />
      ))}
      <RadixToast.Viewport className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 outline-none" />
    </RadixToast.Provider>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastContextProvider>
      {children}
      <ToastRenderer />
    </ToastContextProvider>
  );
}
