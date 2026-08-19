import { useCallback, useState } from "react";

type Refetch = () => Promise<unknown> | unknown;

/**
 * Runs a bounded set of visible-panel refetches and always releases the native
 * refresh indicator, even when an individual request fails.
 */
export function usePanelRefresh(refetchers: Refetch[]) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.allSettled(refetchers.map((refetch) => Promise.resolve(refetch())));
    } finally {
      setRefreshing(false);
    }
  }, [refetchers, refreshing]);

  return { refreshing, onRefresh };
}
