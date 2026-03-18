# Mobile Screen Test Generator

You are a **Mobile Test Orchestrator** for RealFlow. You set up context, spawn `@qa-engineer` to generate `@testing-library/react-native` tests for Expo screens, then verify all 5 required states are covered before writing.

## Context

$ARGUMENTS

## Agent Delegation

**Specialist:** `@qa-engineer` → `subagent_type: "qa-engineer"`

```
Task prompt: "Generate @testing-library/react-native Vitest tests for the Expo screen at
$ARGUMENTS. Read the screen file completely first to understand its data fetching and UI states.
Apply all 4 RealFlow Vitest rules (UUID fixtures, vi.hoisted() for Supabase mocks, class
constructor mocking, Supabase chain termination). Wrap all renders with QueryClientProvider
using retry: false. Cover all 5 required states: (1) loading indicator while fetching — mock
never resolves; (2) empty state when data is [] — verify empty state text shown; (3) records
rendered when data loads — verify record name/title visible; (4) error message shown on fetch
failure — verify error text matches screen's error display; (5) navigation triggered on item
press — verify router.push called with record ID. Use await waitFor() for all async assertions.
Return the complete test file content."
```

Agent returns: Complete `*.test.tsx` file with all 5 required states covered, vi.hoisted() Supabase mocks, proper UUID fixtures, and QueryClientProvider wrapper.
Orchestrator gate: Verify the returned content has tests for all 5 states (loading, empty, data, error, navigation). If complete, write to the expected test file path alongside the screen file.

## Reference

Read the screen file in `apps/mobile/app/` before generating.

## Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Expo Router
vi.mock('expo-router', () => ({
  router: { push: vi.fn(), back: vi.fn() },
  useLocalSearchParams: vi.fn(() => ({})),
}));

// vi.hoisted() for Supabase mocks — Rule 2: never reference top-level const in vi.mock factory
const { mockOrder } = vi.hoisted(() => {
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  return { mockOrder };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ order: mockOrder }) }),
    }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: '00000000-0000-0000-0000-000000000001' } } }) },
  },
}));

// Proper UUIDs in all fixtures — Rule 1
const TEST_RECORD = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test Record',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }, // No retries in tests
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

import FeatureScreen from './FeatureScreen';

describe('FeatureScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading indicator while fetching', () => {
    mockOrder.mockReturnValue(new Promise(() => {})); // Never resolves
    renderWithQuery(<FeatureScreen />);
    expect(screen.UNSAFE_queryByType(require('react-native').ActivityIndicator)).toBeTruthy();
  });

  it('shows empty state when no records', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });
    renderWithQuery(<FeatureScreen />);
    await waitFor(() => expect(screen.getByText('No items yet')).toBeTruthy());
  });

  it('renders records when data loads', async () => {
    mockOrder.mockResolvedValueOnce({ data: [TEST_RECORD], error: null });
    renderWithQuery(<FeatureScreen />);
    await waitFor(() => expect(screen.getByText('Test Record')).toBeTruthy());
  });

  it('shows error message on fetch failure', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'Network error' } });
    renderWithQuery(<FeatureScreen />);
    await waitFor(() => expect(screen.getByText(/Network error|Failed to load/i)).toBeTruthy());
  });

  it('navigates to detail on item press', async () => {
    const { router } = await import('expo-router');
    mockOrder.mockResolvedValueOnce({ data: [TEST_RECORD], error: null });
    renderWithQuery(<FeatureScreen />);
    await waitFor(() => fireEvent.press(screen.getByText('Test Record')));
    expect(router.push).toHaveBeenCalledWith(expect.stringContaining(TEST_RECORD.id));
  });
});
```

## Rules

- Always wrap with `QueryClientProvider` with `retry: false`
- Use `await waitFor()` for all async assertions
- Use `vi.hoisted()` for Supabase mocks (Vitest Rule 2)
- Use proper UUIDs in all fixtures (Vitest Rule 1)
- Dates render as `toLocaleDateString('en-AU')` in AU format
- Must test: loading, empty, data loaded, error, navigation/interaction
- Add `testID` props to loading/empty state elements for reliable test queries
