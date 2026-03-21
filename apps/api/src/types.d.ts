// Type declarations for optional dependencies
declare module '@sentry/node' {
  export function init(options: Record<string, unknown>): void;
  export function withScope(
    callback: (scope: {
      setTag(key: string, value: string): void;
      setUser(user: { id: string }): void;
      setExtra(key: string, value: unknown): void;
    }) => void,
  ): void;
  export function captureException(error: Error): void;
  export function close(timeout: number): Promise<boolean>;
}
