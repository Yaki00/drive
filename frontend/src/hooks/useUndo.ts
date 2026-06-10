import { useCallback, useRef, useState } from 'react';

export interface UndoEntry {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const MAX_STACK = 20;

export function useUndo() {
  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const syncCounts = useCallback(() => {
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
  }, []);

  const push = useCallback(
    (entry: UndoEntry) => {
      undoStackRef.current.push(entry);
      if (undoStackRef.current.length > MAX_STACK) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      syncCounts();
    },
    [syncCounts],
  );

  const undo = useCallback(async () => {
    const entry = undoStackRef.current[undoStackRef.current.length - 1];
    if (!entry) return { label: null, error: null };

    try {
      await entry.undo();
      undoStackRef.current.pop();
      redoStackRef.current.push(entry);
      syncCounts();
      return { label: entry.label, error: null };
    } catch (err) {
      return {
        label: null,
        error: err instanceof Error ? err.message : 'Échec du retour arrière',
      };
    }
  }, [syncCounts]);

  const redo = useCallback(async () => {
    const entry = redoStackRef.current[redoStackRef.current.length - 1];
    if (!entry) return { label: null, error: null };

    try {
      await entry.redo();
      redoStackRef.current.pop();
      undoStackRef.current.push(entry);
      syncCounts();
      return { label: entry.label, error: null };
    } catch (err) {
      return {
        label: null,
        error: err instanceof Error ? err.message : 'Échec du rétablissement',
      };
    }
  }, [syncCounts]);

  const clear = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncCounts();
  }, [syncCounts]);

  return {
    push,
    undo,
    redo,
    clear,
    undoCount,
    redoCount,
    canUndo: undoCount > 0,
    canRedo: redoCount > 0,
  };
}
