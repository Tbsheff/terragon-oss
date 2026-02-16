"use client";

import React, { useCallback, useMemo, useState } from "react";

export type LayoutMode = "focus" | "split" | "grid";

type ParallelLayoutContextType = {
  activePaneId: string | null;
  layoutMode: LayoutMode;
  paneIds: string[];
  setActivePane: (id: string) => void;
  setLayout: (mode: LayoutMode) => void;
  addPane: (id: string) => void;
  removePane: (id: string) => void;
};

const ParallelLayoutContext = React.createContext<ParallelLayoutContextType>({
  activePaneId: null,
  layoutMode: "split",
  paneIds: [],
  setActivePane: () => {},
  setLayout: () => {},
  addPane: () => {},
  removePane: () => {},
});

export const useParallelLayout = () => React.useContext(ParallelLayoutContext);

export function ParallelLayoutProvider({
  children,
  initialPaneIds = [],
  initialLayout = "split",
  initialActive = null,
}: {
  children: React.ReactNode;
  initialPaneIds?: string[];
  initialLayout?: LayoutMode;
  initialActive?: string | null;
}) {
  const [paneIds, setPaneIds] = useState<string[]>(initialPaneIds);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initialLayout);
  const [activePaneId, setActivePaneId] = useState<string | null>(
    initialActive ?? initialPaneIds[0] ?? null,
  );

  const setActivePane = useCallback((id: string) => {
    setActivePaneId(id);
  }, []);

  const setLayout = useCallback((mode: LayoutMode) => {
    setLayoutMode(mode);
  }, []);

  const addPane = useCallback((id: string) => {
    setPaneIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
    // Auto-activate if first pane
    setActivePaneId((prev) => prev ?? id);
  }, []);

  const removePane = useCallback(
    (id: string) => {
      setPaneIds((prev) => prev.filter((p) => p !== id));
      setActivePaneId((prev) => {
        if (prev !== id) return prev;
        // Pick next available pane
        const remaining = paneIds.filter((p) => p !== id);
        return remaining[0] ?? null;
      });
    },
    [paneIds],
  );

  const value = useMemo(
    () => ({
      activePaneId,
      layoutMode,
      paneIds,
      setActivePane,
      setLayout,
      addPane,
      removePane,
    }),
    [
      activePaneId,
      layoutMode,
      paneIds,
      setActivePane,
      setLayout,
      addPane,
      removePane,
    ],
  );

  return (
    <ParallelLayoutContext.Provider value={value}>
      {children}
    </ParallelLayoutContext.Provider>
  );
}
