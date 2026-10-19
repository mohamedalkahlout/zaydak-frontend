"use client"

import type { MouseEvent, ReactElement, ReactNode } from "react"
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"
import { motion, useMotionValue, useSpring } from "motion/react"

import { useHydrated, useSafeReducedMotion } from "../hooks/use-hydrated"
import { cn } from "../lib/utils"

/**
 * Aceternity's Link Preview (https://ui.aceternity.com/components/link-preview),
 * ported onto this repo's primitives.
 *
 * Two substitutions, both to avoid a dependency that would duplicate something
 * already here:
 *
 * - **Base UI's `PreviewCard`, not `@radix-ui/react-hover-card`.** Every overlay
 *   in this package (`hover-card`, `popover`, `tooltip`, `dialog`) is Base UI —
 *   the shadcn style is `base-nova`. Adding Radix for one component would ship a
 *   second portal/dismiss/RTL engine whose behaviour diverges from every other
 *   primitive here at exactly the moments that are hardest to notice.
 * - **`URLSearchParams`, not `qss`.** `qss` exists in the original only to build
 *   the microlink query string, which is flat and string-valued.
 *
 * What is kept is the part that makes this the component and not a hover card
 * with an image in it: the panel tracks the cursor's horizontal offset from the
 * trigger's centre on a spring, and the image is preloaded off-screen so the
 * first hover shows a picture rather than an empty frame.
 *
 * Enter/exit is CSS on the popup (`data-open` / `data-closed`) rather than
 * `AnimatePresence`, because Base UI owns the popup's mount lifecycle and waits
 * on a CSS animation before unmounting — a motion exit would be cut off
 * mid-flight. The spring character is kept with a back-out easing curve.
 */
export type LinkPreviewProps = {
  /** The trigger's content. */
  children: ReactNode
  /** Class for the trigger element. */
  className?: string
  /** Panel size in px. Also drives the microlink viewport (3x, for retina). */
  width?: number
  height?: number
  /** Which side of the trigger the panel opens on. */
  side?: "top" | "bottom" | "left" | "right"
  /** ms before the panel opens on hover. Base UI's own default is 600 — slow. */
  delay?: number
  closeDelay?: number
  /**
   * Replaces the trigger's element. The default is an `<a href={url}>`, which
   * cannot be nested inside an existing control — pass e.g. `<button />` to make
   * a control you already render *be* the trigger.
   */
  render?: ReactElement
  /** Class for the panel's frame (the padded border around the image). */
  previewClassName?: string
} & (
  | {
      /** Preview a known image instead of screenshotting a URL. */
      isStatic: true
      imageSrc: string
      /** Optional in static mode: with no `url`, nothing renders as a link. */
      url?: string
    }
  | { isStatic?: false; imageSrc?: never; url: string }
)

export function LinkPreview({
  children,
  className,
  width = 200,
  height = 125,
  side = "top",
  delay = 120,
  closeDelay = 100,
  render,
  previewClassName,
  isStatic = false,
  imageSrc,
  url,
}: LinkPreviewProps) {
  const src = isStatic
    ? (imageSrc as string)
    : `https://api.microlink.io/?${new URLSearchParams({
        url: url as string,
        screenshot: "true",
        meta: "false",
        embed: "screenshot.url",
        colorScheme: "dark",
        "viewport.isMobile": "true",
        "viewport.deviceScaleFactor": "1",
        "viewport.width": String(width * 3),
        "viewport.height": String(height * 3),
      })}`

  // The preload is client-only. In URL mode it is a request to a third party per
  // preview on the page, and putting that in the server-rendered HTML would fire
  // it for every crawler and every prefetch, not just the sessions that hover.
  const hydrated = useHydrated()

  // The cursor-follow is decoration on top of a panel that is already positioned
  // correctly, so under `prefers-reduced-motion` it simply does not happen.
  const still = useSafeReducedMotion()

  const x = useMotionValue(0)
  const translateX = useSpring(x, { stiffness: 100, damping: 15 })

  // `currentTarget`, not `target`: the trigger wraps arbitrary content, and
  // `target` measures whichever child the cursor is over — so the panel would
  // lurch as the cursor crossed from a card's image to its label.
  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    if (still) return
    const rect = event.currentTarget.getBoundingClientRect()
    x.set((event.clientX - rect.left - rect.width / 2) / 2)
  }

  const frameClass = cn(
    "block rounded-xl border-2 border-transparent bg-popover p-1 text-[0px] shadow-xl",
    previewClassName,
  )
  // Raw `<img>`, not `next/image`: in URL mode the source is microlink, and the
  // optimizer would need every previewed host allow-listed in `remotePatterns`
  // to render a link the author wrote inline. This is also a hover-only panel —
  // it is never the LCP element, which is what the rule is guarding.
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={width}
      height={height}
      alt=""
      aria-hidden
      draggable={false}
      className="rounded-lg object-cover"
    />
  )

  return (
    <>
      {hydrated && (
        <div className="hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={width} height={height} alt="" aria-hidden />
        </div>
      )}

      <PreviewCardPrimitive.Root>
        <PreviewCardPrimitive.Trigger
          delay={delay}
          closeDelay={closeDelay}
          href={render ? undefined : url}
          render={render}
          onMouseMove={handleMouseMove}
          className={className}
        >
          {children}
        </PreviewCardPrimitive.Trigger>

        <PreviewCardPrimitive.Portal>
          <PreviewCardPrimitive.Positioner
            side={side}
            align="center"
            sideOffset={10}
            className="isolate z-50"
          >
            <PreviewCardPrimitive.Popup
              className={cn(
                "origin-(--transform-origin) outline-hidden",
                "duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-60 data-open:slide-in-from-bottom-2",
                "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-60 data-closed:slide-out-to-bottom-2",
              )}
            >
              <motion.div style={{ x: translateX }}>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(frameClass, "hover:border-border")}
                  >
                    {image}
                  </a>
                ) : (
                  <div className={frameClass}>{image}</div>
                )}
              </motion.div>
            </PreviewCardPrimitive.Popup>
          </PreviewCardPrimitive.Positioner>
        </PreviewCardPrimitive.Portal>
      </PreviewCardPrimitive.Root>
    </>
  )
}
