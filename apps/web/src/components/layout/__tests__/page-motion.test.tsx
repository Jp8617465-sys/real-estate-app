import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageMotion, StaggerContainer, MotionItem } from '../page-motion';

// Mock useReducedMotion to control animation skip
vi.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

import { useReducedMotion } from '@/hooks/use-reduced-motion';

describe('PageMotion', () => {
  it('renders children', () => {
    render(
      <PageMotion>
        <p>Content</p>
      </PageMotion>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders a plain div when reduced motion is true', () => {
    vi.mocked(useReducedMotion).mockReturnValueOnce(true);
    const { container } = render(
      <PageMotion>
        <p>No anim</p>
      </PageMotion>,
    );
    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  it('passes className to wrapper', () => {
    vi.mocked(useReducedMotion).mockReturnValueOnce(true);
    const { container } = render(
      <PageMotion className="p-4">
        <p>x</p>
      </PageMotion>,
    );
    expect((container.firstChild as HTMLElement).className).toContain('p-4');
  });
});

describe('StaggerContainer', () => {
  it('renders children', () => {
    render(
      <StaggerContainer>
        <MotionItem>
          <p>Item 1</p>
        </MotionItem>
        <MotionItem>
          <p>Item 2</p>
        </MotionItem>
      </StaggerContainer>,
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('falls back to plain divs in reduced motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { container } = render(
      <StaggerContainer>
        <MotionItem>
          <span>x</span>
        </MotionItem>
      </StaggerContainer>,
    );
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });
});
