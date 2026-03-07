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

import { lazy, type ComponentType } from 'react';

// ─── Helper: Retry dynamic import on chunk load failure ─────────────────────────

async function retryImport<T>(
  importFn: () => Promise<T>,
  retries: number,
  delay: number,
): Promise<T> {
  try {
    return await importFn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryImport(importFn, retries - 1, delay);
  }
}

/**
 * Create a lazy component from a named export, with automatic retry on
 * chunk load failure. Network issues can cause chunk loads to fail —
 * retrying once after a short delay resolves most transient failures.
 */
function lazyNamed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  factory: () => Promise<{ default: ComponentType<any> }>,
  retries = 2,
  delay = 1000,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): React.LazyExoticComponent<ComponentType<any>> {
  return lazy(() => retryImport(factory, retries, delay));
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
