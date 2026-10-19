"use client"

import { startTransition, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

interface PendingWrite {
  /** The committed URL when the chain began, then each earlier write that may still land. */
  seen: string[]
  to: string
}

/**
 * `router.replace` for list search params, remembering the write until the
 * router catches up.
 *
 * FilterBar chips are React state; the URL is derived from them. A replace
 * runs in a transition, so for a frame the URL still holds the previous
 * filters. Rebuilding chips from that stale URL drops an empty chip (or
 * undoes a field change) and, with `useSuspenseQuery`, the table remounts
 * as a skeleton. List screens skip that rebuild while a write is in flight
 * and build the next URL from `base`, not from the committed params.
 */
export function useSearchReplace() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const committed = searchParams.toString()

  const [pending, setPending] = useState<PendingWrite | null>(null)
  if (
    pending &&
    (committed === pending.to || !pending.seen.includes(committed))
  ) {
    setPending(null)
  }

  const base = pending?.to ?? committed
  const writeInFlight =
    pending != null &&
    pending.seen.includes(committed) &&
    committed !== pending.to

  const replaceSearch = (params: URLSearchParams) => {
    const next = params.toString()
    if (next === base) return false
    setPending({
      seen: pending ? [...pending.seen, pending.to] : [committed],
      to: next,
    })
    startTransition(() => {
      router.replace(next ? `${pathname}?${next}` : pathname, {
        scroll: false,
      })
    })
    return true
  }

  return { searchParams, committed, base, writeInFlight, replaceSearch }
}
