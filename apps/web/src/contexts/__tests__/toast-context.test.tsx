import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useContext } from 'react';
import { ToastContext, ToastContextProvider, useToast } from '../toast-context';

function ToastConsumer() {
  const { toast } = useToast();
  return (
    <button onClick={() => toast({ message: 'Hello!', variant: 'success' })}>
      Show Toast
    </button>
  );
}

function ToastDisplay() {
  const ctx = useContext(ToastContext);
  return (
    <div>
      {ctx?.toasts.map((t) => (
        <div key={t.id} data-testid="toast-entry">
          {t.message} — {t.variant}
        </div>
      ))}
    </div>
  );
}

describe('ToastContextProvider', () => {
  it('provides toast() that adds a toast entry', () => {
    render(
      <ToastContextProvider>
        <ToastConsumer />
        <ToastDisplay />
      </ToastContextProvider>,
    );

    act(() => {
      screen.getByRole('button', { name: 'Show Toast' }).click();
    });

    expect(screen.getByTestId('toast-entry')).toHaveTextContent('Hello! — success');
  });

  it('dismiss() closes a toast', () => {
    function Dismisser() {
      const { toast, dismiss } = useToast();
      const ctx = useContext(ToastContext);
      return (
        <>
          <button onClick={() => { const id = toast({ message: 'Bye', variant: 'info' }); dismiss(id); }}>
            Toast+Dismiss
          </button>
          <div>{ctx?.toasts.map((t) => <span key={t.id}>{t.open ? 'open' : 'closed'}</span>)}</div>
        </>
      );
    }

    render(
      <ToastContextProvider>
        <Dismisser />
      </ToastContextProvider>,
    );

    act(() => {
      screen.getByRole('button', { name: 'Toast+Dismiss' }).click();
    });

    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('throws when useToast is used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ToastConsumer />)).toThrow('useToast must be used within');
    consoleError.mockRestore();
  });
});
