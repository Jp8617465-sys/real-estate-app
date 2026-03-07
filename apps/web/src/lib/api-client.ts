/**
 * Shared API fetch helper for web hooks.
 *
 * Handles:
 * - Non-ok response → throws with API error message
 * - 204 No Content → returns undefined without attempting JSON parse
 * - All other 2xx → returns parsed JSON
 *
 * Hooks that need auth headers or query-param URL construction should build
 * those concerns into their own wrappers and call this function as the primitive.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((body as { error?: string }).error ?? 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
