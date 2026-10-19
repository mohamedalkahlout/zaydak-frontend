"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

/**
 * Tiny undo/redo history for the query text. Doesn't ship a full undo
 * tree — just a linear stack of distinct value snapshots, debounced so
 * every keystroke doesn't push a new entry.
 *
 *   - push(value) → debounced 400ms, pushes when value differs from top
 *   - undo / redo → walk the stack
 *   - canUndo / canRedo → boolean flags for button disabled state
 *
 * Keeps the last 50 entries so the buttons don't grow unbounded memory.
 *
 * Synchronous correctness: `canUndo` / `canRedo` are property accessors
 * that read from a ref the mutation methods update *immediately*. That
 * means a consumer can write `if (h.undo() !== null && h.canUndo) ...`
 * without first waiting for React to commit the re-render. The companion
 * `useState` exists only so React components actually re-render when
 * the history walks; it's not the source of truth.
 */

const DEBOUNCE_MS = 400
const MAX_ENTRIES = 50

export interface QueryHistory {
  push: (value: string) => void
  undo: () => string | null
  redo: () => string | null
  readonly canUndo: boolean
  readonly canRedo: boolean
  reset: (value: string) => void
}

interface HistoryState {
  stack: string[]
  index: number
}

export function useQueryHistory(initial: string): QueryHistory {
  const stateRef = useRef<HistoryState>({ stack: [initial], index: 0 })
  const [, force] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const commit = useCallback((next: HistoryState) => {
    stateRef.current = next
    force((n) => n + 1)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const push = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const prev = stateRef.current
        if (prev.stack[prev.index] === value) return
        // Drop the redo tail when a new edit forks the history.
        const truncated = prev.stack.slice(0, prev.index + 1)
        truncated.push(value)
        // Cap entries so the stack doesn't grow without bound.
        const trimmed =
          truncated.length > MAX_ENTRIES
            ? truncated.slice(truncated.length - MAX_ENTRIES)
            : truncated
        commit({ stack: trimmed, index: trimmed.length - 1 })
      }, DEBOUNCE_MS)
    },
    [commit],
  )

  const undo = useCallback((): string | null => {
    const { stack, index } = stateRef.current
    if (index <= 0) return null
    const nextIndex = index - 1
    commit({ stack, index: nextIndex })
    return stack[nextIndex]
  }, [commit])

  const redo = useCallback((): string | null => {
    const { stack, index } = stateRef.current
    if (index >= stack.length - 1) return null
    const nextIndex = index + 1
    commit({ stack, index: nextIndex })
    return stack[nextIndex]
  }, [commit])

  const reset = useCallback(
    (value: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      commit({ stack: [value], index: 0 })
    },
    [commit],
  )

  // useMemo with no deps so the returned object identity is stable. The
  // canUndo/canRedo accessors read the ref each access, so consumers
  // always see the latest values without dirtying object identity.
  return useMemo<QueryHistory>(
    () => ({
      push,
      undo,
      redo,
      reset,
      get canUndo() {
        return stateRef.current.index > 0
      },
      get canRedo() {
        return (
          stateRef.current.index < stateRef.current.stack.length - 1
        )
      },
    }),
    [push, undo, redo, reset],
  )
}
