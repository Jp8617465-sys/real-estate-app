import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineStep } from '../timeline-step';

// Suppress framer-motion warnings in test env
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

const BASE_PROPS = {
  label: 'Finance Clause',
  date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
  status: 'upcoming' as const,
  isCritical: false,
  notes: null,
  isLast: false,
};

describe('TimelineStep', () => {
  it('renders the label', () => {
    render(<TimelineStep {...BASE_PROPS} />);
    expect(screen.getByText('Finance Clause')).toBeInTheDocument();
  });

  it('renders the formatted date', () => {
    render(<TimelineStep {...BASE_PROPS} />);
    // Date should be rendered in en-AU format
    const dateEl = screen.getByText(/\d{4}/);
    expect(dateEl).toBeInTheDocument();
  });

  it('shows Critical badge when isCritical is true', () => {
    render(<TimelineStep {...BASE_PROPS} isCritical />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('does not show Critical badge when isCritical is false', () => {
    render(<TimelineStep {...BASE_PROPS} isCritical={false} />);
    expect(screen.queryByText('Critical')).not.toBeInTheDocument();
  });

  it('renders notes when provided', () => {
    render(<TimelineStep {...BASE_PROPS} notes="Contact solicitor" />);
    expect(screen.getByText('Contact solicitor')).toBeInTheDocument();
  });

  it('does not render notes section when null', () => {
    render(<TimelineStep {...BASE_PROPS} notes={null} />);
    expect(screen.queryByText('Contact solicitor')).not.toBeInTheDocument();
  });

  it('shows Upcoming status label', () => {
    render(<TimelineStep {...BASE_PROPS} status="upcoming" />);
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });

  it('shows Completed status label', () => {
    render(<TimelineStep {...BASE_PROPS} status="completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows Overdue status label', () => {
    render(<TimelineStep {...BASE_PROPS} status="overdue" />);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('shows Due Soon status label', () => {
    render(<TimelineStep {...BASE_PROPS} status="due_soon" />);
    expect(screen.getByText('Due Soon')).toBeInTheDocument();
  });

  it('hides the timeline line when isLast=true', () => {
    const { container } = render(<TimelineStep {...BASE_PROPS} isLast />);
    // Line div is conditionally rendered — only dot div + icon svg are aria-hidden
    const lineEl = container.querySelector('.absolute.left-\\[15px\\]');
    expect(lineEl).toBeNull();
  });

  it('shows the vertical line when isLast=false', () => {
    const { container } = render(<TimelineStep {...BASE_PROPS} isLast={false} />);
    // Line div has the distinctive left-[15px] positioning class
    const lineEl = container.querySelector('.absolute.left-\\[15px\\]');
    expect(lineEl).not.toBeNull();
  });
});
