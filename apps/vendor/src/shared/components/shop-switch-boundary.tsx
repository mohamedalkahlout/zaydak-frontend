"use client"

import { Component, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { isStoreResetError } from "@/shared/lib/apollo/store-reset-error"

interface BoundaryProps {
  /** Changing this clears a caught error — the switch has landed. */
  resetKey: string
  fallback: ReactNode
  children: ReactNode
}

interface BoundaryState {
  error: unknown
  resetKey: string
  /** One free re-render has already been spent on this error. */
  retried: boolean
}

/**
 * The last line of defence around a shop switch.
 *
 * `useSwitchShop` waits for the link chain to go idle before it writes the
 * store, which removes the race in the ordinary case. Two paths remain that it
 * cannot order: a request that outlives the settle cap, and browser
 * Back/Forward between two shops' URLs, where `AppSidebar` mirrors the URL into
 * the store in an effect that runs *after* the new page's `useSuspenseQuery`
 * has already fetched. Both end the same way — `clearStore()` cancels a fetch
 * a suspense reader is holding, and the rejection is thrown at render.
 *
 * Thrown from `DashboardShell` that has nowhere to go: `store/error.tsx` sits
 * *under* the layout, and the vendor app has no `app/error.tsx`, so it would
 * land on `global-error.tsx` — a full-page unstyled screen for what is really
 * a cache clear the app asked for. This boundary keeps that one error, paints
 * the shell's own skeleton, and re-renders once so the queries run again
 * against the settled shop.
 *
 * It rethrows everything else. A genuine failure has to keep reaching the
 * boundary above and Sentry with it; a boundary that quietly eats errors is
 * worse than the error page it replaced.
 */
export class ShopSwitchErrorBoundary extends Component<
  BoundaryProps,
  BoundaryState
> {
  state: BoundaryState = {
    error: null,
    resetKey: this.props.resetKey,
    retried: false,
  }

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error }
  }

  static getDerivedStateFromProps(
    props: BoundaryProps,
    state: BoundaryState,
  ): Partial<BoundaryState> | null {
    if (props.resetKey === state.resetKey) return null
    return { error: null, resetKey: props.resetKey, retried: false }
  }

  componentDidUpdate(_prev: BoundaryProps, prevState: BoundaryState) {
    if (!this.state.error || this.state.retried) return
    if (prevState.error === this.state.error) return
    if (!isStoreResetError(this.state.error)) return
    // The clear that caused this has already finished, so simply rendering the
    // children again starts their queries afresh under the settled shop. One
    // attempt only: if it throws again the fallback stays up rather than
    // spinning a retry loop, and a navigation (or a reload) clears it.
    this.setState({ error: null, retried: true })
  }

  render() {
    const { error } = this.state
    if (error) {
      if (!isStoreResetError(error)) throw error
      return this.props.fallback
    }
    return this.props.children
  }
}

/**
 * `ShopSwitchErrorBoundary` keyed by the current path, so landing on the new
 * shop's URL clears anything the switch threw on the way out.
 */
export function ShopSwitchBoundary({
  fallback,
  children,
}: {
  fallback: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname()
  return (
    <ShopSwitchErrorBoundary resetKey={pathname ?? ""} fallback={fallback}>
      {children}
    </ShopSwitchErrorBoundary>
  )
}
