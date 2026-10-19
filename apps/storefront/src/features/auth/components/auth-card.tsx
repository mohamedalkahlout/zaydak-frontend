"use client"

import Link from "next/link"

import {
  DialogDescription,
  DialogTitle,
} from "@repo/ui/components/dialog"

/**
 * The frame sign-in, sign-up and password reset sit in.
 *
 * Deliberately not `@repo/ui`'s `AuthShell`: that is a full-bleed screen on a
 * shader ground, built for a console you *arrive at* in order to sign in. Here signing in is an interruption in the middle of shopping, so
 * the shop header stays exactly where it was and the form is a panel on the
 * shop's own page — the customer never loses the store they were standing in.
 *
 * `variant` is the two places that panel can be: `page` is the standalone
 * route, `dialog` is the popup `AuthDialog` opens over whatever the shopper
 * was looking at. Same header, same footer, same forms — the popup exists so
 * that filling a cart and signing in are not two different places, and the
 * fastest way to guarantee the two never drift is for there to be one
 * component with a switch rather than two that look alike today.
 */
export function AuthCard({
  title,
  subtitle,
  footerPrompt,
  footerLinkLabel,
  footerHref,
  onFooterClick,
  variant = "page",
  children,
}: {
  title: string
  subtitle: string
  /**
   * The "already have an account?" line. Optional as a set: a screen with no
   * second place to send anybody leaves all three out.
   */
  footerPrompt?: string
  footerLinkLabel?: string
  footerHref?: string
  /**
   * Swaps the footer's `Link` for a button. The popup switches panel in place:
   * navigating to `/register` from inside it would close the popup, throw away
   * the page behind it and defeat the whole point of not leaving.
   */
  onFooterClick?: () => void
  variant?: "page" | "dialog"
  children: React.ReactNode
}) {
  const footer =
    footerPrompt && footerLinkLabel && (onFooterClick || footerHref) ? (
      <p className="mt-5 text-center text-sm text-muted-foreground">
        {footerPrompt}{" "}
        {onFooterClick ? (
          <button
            type="button"
            onClick={onFooterClick}
            className="cursor-pointer font-medium text-shop-accent hover:underline"
          >
            {footerLinkLabel}
          </button>
        ) : (
          <Link
            href={footerHref!}
            className="font-medium text-shop-accent hover:underline"
          >
            {footerLinkLabel}
          </Link>
        )}
      </p>
    ) : null

  // The popup's own surface is the panel, so this adds no second one — a
  // `shop-panel` inside a dialog reads as a card in a box. It owns the gutter,
  // and nothing here scrolls: the dialog is opened with `scroll="viewport"`,
  // so a panel taller than the window is scrolled by the window itself.
  //
  // The density rules are here rather than on each field because a page and a
  // popup want the same form at two sizes, and threading a `compact` flag
  // through every `Input` would be a prop on ~20 call sites that only ever
  // has one value per frame. A route is a screen with room; the popup is a
  // card over the shop, and at the page's h-11 rhythm sign-up ran past the
  // fold on a laptop with its own primary action below it.
  //
  // `DialogTitle`/`DialogDescription` are what name the dialog for a screen
  // reader, which is why the heading is not a plain `<h1>` here.
  if (variant === "dialog") {
    return (
      <div className="px-6 py-8 sm:px-8 [&_[data-slot=button]]:h-10 [&_[data-slot=input]]:h-10 [&_form]:gap-3">
        <header className="mb-5 text-center">
          <DialogTitle className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
            {subtitle}
          </DialogDescription>
        </header>

        {children}
        {footer}
      </div>
    )
  }

  return (
    <div className="shop-container flex justify-center py-14">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="font-heading text-shop-title font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-shop-body text-muted-foreground">{subtitle}</p>
        </header>

        <div className="shop-panel p-6 sm:p-8 lg:p-10">{children}</div>

        {footer}
      </div>
    </div>
  )
}
