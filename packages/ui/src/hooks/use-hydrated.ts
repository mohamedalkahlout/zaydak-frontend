"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

const subscribe = () => () => {};

/**
 * `false` during SSR and the first client render, `true` afterwards. Lets a
 * component render SSR-matching markup first, then switch to client-only values
 * after hydration — without the `setState`-in-effect pattern.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * Like motion's `useReducedMotion`, but hydration-safe: returns `false` on the
 * server and the first client render (so the SSR markup matches), then the real
 * preference after hydration. Prevents hydration mismatches when reduced motion
 * gates a conditionally-rendered element or a motion `initial`.
 */
export function useSafeReducedMotion(): boolean {
  const reduced = useReducedMotion();
  return useHydrated() ? Boolean(reduced) : false;
}
