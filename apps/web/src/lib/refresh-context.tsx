"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface RefreshContextValue {
  /** Incremented each time data should be re-fetched */
  refreshKey: number;
  /** Call after mutations (upload, delete) to trigger re-fetch */
  triggerRefresh: () => void;
}

const RefreshContext = createContext<RefreshContextValue>({
  refreshKey: 0,
  triggerRefresh: () => {},
});

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <RefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  return useContext(RefreshContext);
}
