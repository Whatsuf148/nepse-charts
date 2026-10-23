import { useCallback, useSyncExternalStore } from 'react';
import { get, set, subscribe } from './store';

/** Persistent state backed by the shared store (localStorage + optional cloud sync). */
export function useLocal<T>(key: string, initial: T) {
  const value = useSyncExternalStore(subscribe, () => get(key, initial));
  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => set(key, typeof next === 'function' ? (next as (p: T) => T)(get(key, initial)) : next),
    // `initial` is only used as the first-read default, which the store caches
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, setValue] as const;
}
