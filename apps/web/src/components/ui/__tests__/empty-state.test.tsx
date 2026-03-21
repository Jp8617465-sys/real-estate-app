import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../empty-state';
import type { EmptyStateIllustration } from '@realflow/ui';

const ILLUSTRATIONS: EmptyStateIllustration[] = [
  'contacts',
  'properties',
  'pipeline',
  'alerts',
  'matches',
  'documents',
  'messages',
  'generic',
];

describe('EmptyState', () => {
  it('renders heading', () => {
    render(<EmptyState illustration="contacts" heading="No contacts yet" />);
    expect(screen.getByText('No contacts yet')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <EmptyState
        illustration="properties"
        heading="No properties"
        description="Add your first property to get started"
      />,
    );
    expect(screen.getByText('Add your first property to get started')).toBeInTheDocument();
  });

  it('does not render description when omitted', () => {
    render(<EmptyState illustration="generic" heading="Empty" />);
    expect(screen.queryByText(/add your first/i)).not.toBeInTheDocument();
  });

  it('renders action button when actionLabel and onAction provided', () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        illustration="contacts"
        heading="No contacts"
        actionLabel="Add contact"
        onAction={onAction}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Add contact' });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('does not render button when no onAction', () => {
    render(<EmptyState illustration="generic" heading="Empty" actionLabel="Action" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each(ILLUSTRATIONS)('renders SVG for illustration type %s', (type) => {
    const { container } = render(<EmptyState illustration={type} heading="Test" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('has role=status and aria-label', () => {
    render(<EmptyState illustration="generic" heading="Nothing here" />);
    const el = screen.getByRole('status', { name: 'Nothing here' });
    expect(el).toBeInTheDocument();
  });
});
