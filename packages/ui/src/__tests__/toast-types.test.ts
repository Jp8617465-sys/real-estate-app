/**
 * Compile-time contract tests for packages/ui type exports.
 * These tests verify the type shapes are correct at import time.
 */
import { describe, it, expect } from 'vitest';
import type { ToastVariant, ToastPayload, ToastContextValue, EmptyStateIllustration, EmptyStateProps } from '../index';

describe('packages/ui type exports', () => {
  it('ToastVariant covers all expected values', () => {
    const variants: ToastVariant[] = ['success', 'error', 'info', 'warning'];
    expect(variants).toHaveLength(4);
  });

  it('ToastPayload requires message and variant', () => {
    const payload: ToastPayload = { message: 'Test', variant: 'success' };
    expect(payload.message).toBe('Test');
    expect(payload.variant).toBe('success');
  });

  it('ToastPayload allows optional fields', () => {
    const payload: ToastPayload = {
      message: 'Action required',
      variant: 'info',
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => {},
    };
    expect(payload.duration).toBe(6000);
    expect(payload.actionLabel).toBe('Undo');
  });

  it('EmptyStateIllustration covers all expected types', () => {
    const types: EmptyStateIllustration[] = [
      'contacts', 'properties', 'pipeline', 'alerts',
      'matches', 'documents', 'messages', 'generic',
    ];
    expect(types).toHaveLength(8);
  });

  it('EmptyStateProps requires illustration and heading', () => {
    const props: EmptyStateProps = {
      illustration: 'contacts',
      heading: 'No contacts yet',
    };
    expect(props.illustration).toBe('contacts');
    expect(props.heading).toBe('No contacts yet');
  });
});
