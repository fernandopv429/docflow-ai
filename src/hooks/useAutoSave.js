import { useEffect, useRef } from 'react';

// Auto-saves every `interval` ms, only when data actually changed since the last save.
export function useAutoSave({ enabled, data, onSave, interval = 30000 }) {
  const snapRef = useRef(null);
  const lastSavedRef = useRef(null);
  const onSaveRef = useRef(onSave);

  snapRef.current = JSON.stringify(data);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (!enabled) return;
    // Baseline: don't save what was just loaded
    lastSavedRef.current = snapRef.current;
    const timer = setInterval(() => {
      if (snapRef.current !== lastSavedRef.current) {
        lastSavedRef.current = snapRef.current;
        onSaveRef.current?.();
      }
    }, interval);
    return () => clearInterval(timer);
  }, [enabled, interval]);
}