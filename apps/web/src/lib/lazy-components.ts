/**
 * Code Splitting Utilities
 *
 * Dynamic imports with React.lazy for heavy components, Suspense
 * boundaries with loading fallbacks, and route preloading.
 *
 * Usage:
 *   import { LazyAnalyticsCharts, LazyWorkflowBuilder } from '@/lib/lazy-components';
 *
 *   <Suspense fallback={<ComponentSkeleton />}>
 *     <LazyAnalyticsCharts />
 *   </Suspense>
 */

import { lazy, type ComponentType } from 'react';

// ─── Helper: Create lazy component with retry ───────────────────────────────────

/**
 * Create a lazy-loaded component with automatic retry on chunk load failure.
 * Network issues can cause chunk loads to fail — retrying once after a short
 * delay resolves most transient failures.
 */
function lazyWithRetry<T extends ComponentType<never>>(
  importFn: () => Promise<{ default: T }>,
  retries = 2,
  delay = 1000,
): React.LazyExoticComponent<T> {
  return lazy(() => retryImport(importFn, retries, delay));
}

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

// ─── Lazy Components: Analytics (heavy — recharts dependency) ───────────────────

export const LazyChartContainer = lazyWithRetry(
  () => import('@/components/analytics/chart-container'),
);

export const LazyFunnelChart = lazyWithRetry(
  () => import('@/components/analytics/funnel-chart'),
);

export const LazyDataTable = lazyWithRetry(
  () => import('@/components/analytics/data-table'),
);

export const LazyMetricCard = lazyWithRetry(
  () => import('@/components/analytics/metric-card'),
);

// ─── Lazy Components: Workflow Builder (complex drag-and-drop) ──────────────────

export const LazyWorkflowBuilder = lazyWithRetry(
  () => import('@/components/workflows/workflow-builder'),
);

// ─── Lazy Components: Social Media (content calendar, post creation) ────────────

export const LazyContentCalendar = lazyWithRetry(
  () => import('@/components/social/content-calendar'),
);

export const LazyCreatePostDialog = lazyWithRetry(
  () => import('@/components/social/create-post-dialog'),
);

// ─── Lazy Components: Pipeline Board (drag-and-drop columns) ────────────────────

export const LazyPipelineBoard = lazyWithRetry(
  () => import('@/components/pipeline/pipeline-board'),
);

export const LazyBAPipelineBoard = lazyWithRetry(
  () => import('@/components/buyers-agent/ba-pipeline-board'),
);

// ─── Lazy Components: Inbox (conversation view) ────────────────────────────────

export const LazyConversationView = lazyWithRetry(
  () => import('@/components/inbox/conversation-view'),
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
