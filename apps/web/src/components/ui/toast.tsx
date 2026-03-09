'use client';

import * as RadixToast from '@radix-ui/react-toast';
import { cn } from '@/lib/utils';
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import type { ToastVariant } from '@realflow/ui';

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100',
  error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100',
};

const VARIANT_ICONS: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

interface ToastItemProps {
  id: string;
  message: string;
  variant: ToastVariant;
  open: boolean;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ToastItem({
  id,
  message,
  variant,
  open,
  duration = 4000,
  actionLabel,
  onAction,
  onOpenChange,
}: ToastItemProps) {
  const Icon = VARIANT_ICONS[variant];

  return (
    <RadixToast.Root
      key={id}
      open={open}
      onOpenChange={onOpenChange}
      duration={duration || undefined}
      className={cn(
        'flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg',
        'data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right',
        VARIANT_STYLES[variant],
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <RadixToast.Description className="text-sm font-medium leading-snug">
          {message}
        </RadixToast.Description>
        {actionLabel && onAction && (
          <RadixToast.Action
            altText={actionLabel}
            onClick={onAction}
            className="mt-1 text-xs font-semibold underline underline-offset-2 hover:no-underline"
          >
            {actionLabel}
          </RadixToast.Action>
        )}
      </div>
      <RadixToast.Close
        className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </RadixToast.Close>
    </RadixToast.Root>
  );
}

export { RadixToast as Toast };
