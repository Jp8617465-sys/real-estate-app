import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../empty-state';

function MockIcon({ className }: { className?: string }) {
  return <svg data-testid="mock-icon" className={className} aria-hidden="true" />;
}

describe('EmptyState (portal)', () => {
  it('renders heading and description', () => {
    render(
      <EmptyState
        icon={MockIcon}
        heading="No documents"
        description="Upload your first document to get started."
      />,
    );
    expect(screen.getByText('No documents')).toBeInTheDocument();
    expect(screen.getByText('Upload your first document to get started.')).toBeInTheDocument();
  });

  it('renders icon with aria-hidden', () => {
    render(
      <EmptyState
        icon={MockIcon}
        heading="Empty"
        description="Nothing here."
      />,
    );
    expect(screen.getByTestId('mock-icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has role="status" with accessible label', () => {
    render(
      <EmptyState
        icon={MockIcon}
        heading="No messages"
        description="Start a conversation."
      />,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-label', 'No messages');
  });

  it('renders action when provided', () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={MockIcon}
        heading="No items"
        description="Create one."
        action={<button onClick={handleClick}>Add item</button>}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Add item' });
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not render action slot when omitted', () => {
    render(
      <EmptyState
        icon={MockIcon}
        heading="Empty"
        description="Nothing."
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
