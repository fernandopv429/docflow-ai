import { useState, useCallback } from 'react';

const MAX_HISTORY = 100;

export function useDocumentHistory() {
  const [history, setHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const addToHistory = useCallback(
    (content) => {
      const base = history.slice(0, currentIndex + 1);
      const next = [...base, content].slice(-MAX_HISTORY);
      setHistory(next);
      setCurrentIndex(next.length - 1);
    },
    [history, currentIndex]
  );

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      return history[currentIndex - 1];
    }
    return undefined;
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return history[currentIndex + 1];
    }
    return undefined;
  }, [currentIndex, history]);

  return {
    addToHistory,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
  };
}