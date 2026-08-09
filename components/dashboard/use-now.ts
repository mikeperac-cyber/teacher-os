"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * The current time, or `null` until the component has mounted.
 *
 * WHY NULL FIRST
 * --------------
 * The dashboard renders time-relative text — "In 48 min", "Overdue by 2 days".
 * If the server rendered those from its clock and the client recomputed them a
 * moment later, React would report a hydration mismatch on every load.
 *
 * `useSyncExternalStore` is the right primitive for this: the clock is an
 * external source, and it takes a separate server snapshot. React uses that
 * server snapshot for both the server render and the hydrating client render,
 * so the two agree by construction, then re-renders with the live value.
 *
 * The snapshot is bucketed to `refreshMs` because `useSyncExternalStore`
 * compares snapshots by identity — returning `Date.now()` directly would report
 * a change on every read and re-render forever.
 *
 * PHASE 3 REPLACES THIS
 * ---------------------
 * Once the dashboard is a server component, `now` is captured server-side and
 * the derived view models arrive as props. There is then no second render to
 * disagree with, and no need for this hook at all.
 */
export function useNow(refreshMs = 60_000): Date | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const id = window.setInterval(onStoreChange, refreshMs);
      return () => window.clearInterval(id);
    },
    [refreshMs],
  );

  const getSnapshot = useCallback(
    () => Math.floor(Date.now() / refreshMs) * refreshMs,
    [refreshMs],
  );

  const getServerSnapshot = useCallback(() => null, []);

  const timestamp = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return useMemo(
    () => (timestamp === null ? null : new Date(timestamp)),
    [timestamp],
  );
}
