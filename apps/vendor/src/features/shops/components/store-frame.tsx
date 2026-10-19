"use client";

import type { ReactNode } from "react";
import { ShaderBackground } from "@repo/ui/components/shader-background";
import { cn } from "@repo/ui/lib/utils";
import { AppLogo } from "@/shared/components/app-logo";

/**
 * The frame the store screens outside the dashboard stand in: `/shops` (pick
 * one), `/create-store` (make one), and the last pane of `/register` (same
 * question as create). Brand at the top start, one slot at the top end, a
 * question centred on the ground, and a white card under it.
 *
 * It is the same composition as `AuthShell` and deliberately not that
 * component: this pair puts the brand at the top *corner* rather than centred
 * over the headline, and `/create-store` hangs a back control off the card's
 * outer edge, which the auth column has no room for. What they do share is the
 * ground — `ShaderBackground`, the same mesh-drift field every entry screen
 * stands on — so signing in, picking a store and creating one are one picture.
 *
 * Presentational: it reads no store, runs no query, and every string arrives
 * already localized.
 */
export function StoreFrame({
  action,
  title,
  subtitle,
  aside,
  children,
  cardClassName,
  logoHref = "/shops",
}: {
  /** Top end of the page — the account chip, or a Skip control. */
  action?: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  /**
   * Hung off the card's outer edge on `sm` and up, stacked above it below
   * that — the back control. `main`'s wide horizontal padding is what leaves
   * room for it; it is the reason for that padding.
   */
  aside?: ReactNode;
  children: ReactNode;
  cardClassName?: string;
  /**
   * Where the brand mark goes. Signup's last pane is not authenticated yet, so
   * it passes `null` rather than sending the vendor to `/shops`.
   */
  logoHref?: string | null;
}) {
  return (
    // The screen paints its own dark ground instead of reading the theme
    // tokens: it sits outside the dashboard shell and is the same picture in
    // light and dark, which is what lets the card be plain white in both.
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#050a0e] text-white">
      {/* The ground. `pointer-events-none` keeps it out of the card's way
          without disabling its cursor response — it tracks the pointer on
          `window`, not on the canvas. */}
      <ShaderBackground className="pointer-events-none absolute inset-0" />
      {/* Scrim. The recipe's brightest colour is near-white, so its lobes
          would drift under the white heading and take the contrast with them. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(3,7,12,0.72),rgba(3,7,12,0.5)_45%,rgba(3,7,12,0.72))]"
      />

      <header className="relative z-10 flex items-center justify-between gap-3 px-6 py-5 sm:px-10">
        <AppLogo variant="desktop" size="md" href={logoHref} priority />
        {action}
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-4 pt-10 pb-16 sm:px-20 sm:pt-20">
        <h1 className="text-center text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 text-center text-base text-white/55 sm:text-lg">
          {subtitle}
        </p>

        <div className="relative mt-10 w-full max-w-xl">
          {aside ? (
            <div className="mb-3 sm:absolute sm:-start-14 sm:top-0 sm:mb-0">
              {aside}
            </div>
          ) : null}
          <div
            className={cn(
              "rounded-2xl bg-white p-5 text-zinc-900 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)] sm:p-6",
              cardClassName,
            )}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
