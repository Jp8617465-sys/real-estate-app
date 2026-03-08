/**
 * Code Splitting Utilities
 *
 * Dynamic imports with React.lazy for heavy components, Suspense
 * boundaries with loading fallbacks, and route preloading.
 *
 * Usage:
 *   import { LazyChartContainer, LazyWorkflowBuilder } from '@/lib/lazy-components';
 *
 *   <Suspense fallback={<ComponentSkeleton />}>
 *     <LazyChartContainer {...props} />
 *   </Suspense>
 */

import { lazy, type ComponentType, type ExoticComponent } from 'react';

// ─── Local type alias: constraint-free lazy component result ────────────────────

/**
 * Structurally equivalent to React.LazyExoticComponent<T> but without the
 * built-in component constraint, so that ComponentType<never> (the
 * contravariant supertype) is accepted by the type-checker.
 */
type LazyComponent<T extends ComponentType<never>> = ExoticComponent<
  T extends ComponentType<infer P> ? P : never
> & { readonly _result: T };

// ─── Helper: Retry dynamic import on chunk load failure ─────────────────────────

async function retryImport<T>(
  importFn: () => Promise<T>,
  retries: number,
  delay: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
    try {
      return await importFn();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Create a lazy component from a named export, with automatic retry on
 * chunk load failure. Network issues can cause chunk loads to fail —
 * retrying once after a short delay resolves most transient failures.
 */
/**
 * Create a lazy component from a named export, with automatic retry on
 * chunk load failure. Typed via the component type T directly to avoid
 * inference issues with ComponentType<P> in contravariant positions.
 */
// ComponentType<never> is the contravariant supertype of all specific ComponentType<P>.
// By function parameter contravariance: never extends P for any P, so every specific
// component type is assignable to ComponentType<never>.
function lazyNamed<T extends ComponentType<never>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  delay = 1000,
): LazyComponent<T> {
  // Cast React.lazy via unknown to bypass the built-in component constraint —
  // ComponentType<never> is the correct contravariant supertype but the cast is needed.
  return (lazy as unknown as (f: () => Promise<unknown>) => LazyComponent<T>)(
    () => retryImport(factory, retries, delay),
  );
}

// ─── Lazy Components: Analytics (heavy — recharts dependency) ───────────────────

export const LazyChartContainer = lazyNamed(() =>
  import('@/components/analytics/chart-container').then((m) => ({
    default: m.ChartContainer,
  })),
);

export const LazyFunnelChart = lazyNamed(() =>
  import('@/components/analytics/funnel-chart').then((m) => ({
    default: m.FunnelChart,
  })),
);

export const LazyDataTable = lazyNamed(() =>
  import('@/components/analytics/data-table').then((m) => ({
    default: m.DataTable,
  })),
);

export const LazyMetricCard = lazyNamed(() =>
  import('@/components/analytics/metric-card').then((m) => ({
    default: m.MetricCard,
  })),
);

// ─── Lazy Components: Workflow Builder (complex drag-and-drop) ──────────────────

export const LazyWorkflowBuilder = lazyNamed(() =>
  import('@/components/workflows/workflow-builder').then((m) => ({
    default: m.WorkflowBuilder,
  })),
);

// ─── Lazy Components: Social Media (content calendar, post creation) ────────────

export const LazyContentCalendar = lazyNamed(() =>
  import('@/components/social/content-calendar').then((m) => ({
    default: m.ContentCalendar,
  })),
);

export const LazyCreatePostDialog = lazyNamed(() =>
  import('@/components/social/create-post-dialog').then((m) => ({
    default: m.CreatePostDialog,
  })),
);

// ─── Lazy Components: Pipeline Board (drag-and-drop columns) ────────────────────

export const LazyPipelineBoard = lazyNamed(() =>
  import('@/components/pipeline/pipeline-board').then((m) => ({
    default: m.PipelineBoard,
  })),
);

export const LazyBAPipelineBoard = lazyNamed(() =>
  import('@/components/buyers-agent/ba-pipeline-board').then((m) => ({
    default: m.BaPipelineBoard,
  })),
);

// ─── Lazy Components: Inbox (conversation view) ────────────────────────────────

export const LazyConversationView = lazyNamed(() =>
  import('@/components/inbox/conversation-view').then((m) => ({
    default: m.ConversationView,
  })),
);

// ─── Route Preloading ───────────────────────────────────────────────────────────

/**
 * Map of route paths to their dynamic import functions.
 * Call preloadRoute() on link hover or route prefetch to start loading
 * the chunk before navigation.
 */
const routeImportMap: Record<string, () => Promise<unknown>> = {
  '/analytics': () => import('@/components/analytics/chart-container'),
  '/workflows': () => import('@/components/workflows/workflow-builder'),
  '/social': () => import('@/components/social/content-calendar'),
  '/pipeline': () => import('@/components/pipeline/pipeline-board'),
  '/inbox': () => import('@/components/inbox/conversation-view'),
};

/** Track preloaded routes to avoid duplicate fetches */
const preloadedRoutes = new Set<string>();

/**
 * Preload the JavaScript chunk for a route.
 * Call on mouseenter/focus of navigation links for instant transitions.
 *
 * Example:
 *   <Link href="/analytics" onMouseEnter={() => preloadRoute('/analytics')}>
 */
export function preloadRoute(path: string): void {
  if (preloadedRoutes.has(path)) return;

  const importFn = routeImportMap[path];
  if (importFn) {
    preloadedRoutes.add(path);
    void importFn();
  }
}

/**
 * Preload all critical routes after initial page load.
 * Call this in a useEffect after the app mounts to warm the chunk cache
 * during idle time.
 *
 * Example:
 *   useEffect(() => {
 *     if (typeof requestIdleCallback !== 'undefined') {
 *       requestIdleCallback(() => preloadCriticalRoutes());
 *     } else {
 *       setTimeout(() => preloadCriticalRoutes(), 2000);
 *     }
 *   }, []);
 */
export function preloadCriticalRoutes(): void {
  const criticalRoutes = ['/pipeline', '/analytics'];

  for (const route of criticalRoutes) {
    preloadRoute(route);
  }
}
