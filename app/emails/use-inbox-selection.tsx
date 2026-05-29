"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Multi-select state for inbox rows. Uses a Set for O(1) membership checks
 * so it scales comfortably to hundreds of selected rows.
 */
export function useInboxSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectMany = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  // Esc clears the current selection.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clear();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds.size, clear]);

  const selectionMode = selectedIds.size > 0;
  const selectedArray = useMemo(() => [...selectedIds], [selectedIds]);

  return {
    selectedIds,
    selectedArray,
    count: selectedIds.size,
    selectionMode,
    isSelected,
    toggle,
    selectMany,
    selectAll,
    clear,
  };
}
