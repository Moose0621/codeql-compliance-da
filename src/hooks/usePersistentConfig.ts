import { useState, useEffect, useRef } from 'react';

/**
 * A lightweight persistence hook that stores JSON-serializable state in localStorage.
 * Designed as a drop-in replacement for the prior useKV usage when the Spark KV
 * store is unavailable or unreliable in certain environments.
 */
export function usePersistentConfig<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(key);
        if (raw) return JSON.parse(raw) as T;
      }
    } catch {
      // Swallow and fall back to initial
    }
    return initial;
  });

  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // Ignore quota or serialization errors silently
    }
  }, [key, value]);

  const update = (next: T | ((prev: T) => T)) => {
    setValue(prev => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next));
  };

  return [value, update];
}
