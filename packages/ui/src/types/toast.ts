// Day-1 contract: shared between web, portal and mobile toast implementations

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastPayload {
  message: string;
  variant: ToastVariant;
  /** Duration in ms — defaults to 4000. Pass 0 for persistent. */
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastContextValue {
  toast(payload: ToastPayload): string;
  dismiss(toastId: string): void;
  dismissAll(): void;
}
