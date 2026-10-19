"use client"

import { useTranslations } from "next-intl"
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react"
import { Sparkles } from "lucide-react"

import { AssistantPanel } from "./assistant-panel"
import { useAssistantStore } from "../store"

/**
 * The pill that opens the assistant, and the only thing mounted until it does.
 *
 * **The panel is not rendered while closed**, which matters more than it looks:
 * it holds a transcript in state, and mounting it eagerly on every page would
 * keep one alive across navigations, so a shopper would find yesterday's
 * conversation waiting. Mounting on open makes "closed" mean closed.
 *
 * Open state lives in `useAssistantStore` so the PDP **Negotiate** control can
 * open this same chat (with a seed prompt) instead of a second offer form.
 *
 * ## Why one `AnimatePresence` in `mode="wait"`
 *
 * The first version gave the pill and the panel an `AnimatePresence` each, as
 * siblings in the same flex column. Both were on screen during the swap, so the
 * column's height changed underneath them mid-flight and the panel arrived with
 * a jump — it read as a layout break rather than as something opening.
 *
 * One presence in `mode="wait"` renders exactly one of them ever: the pill
 * finishes leaving, *then* the panel arrives. Nothing shares the box, so
 * nothing can shove anything.
 *
 * The two halves are deliberately asymmetric. The pill leaves **fast and
 * linearly** (0.12s) because an exit that lingers is an exit you notice; the
 * panel arrives on a **spring from the bottom edge**, which is the direction it
 * would grow if it really were the button expanding. Anchoring the scale to
 * `origin-bottom` is what sells that — scaling from the centre makes it look
 * like a dialog appearing over the page instead.
 *
 * `LazyMotion` + `m` rather than `motion`, matching `CartFlightLayer`: this is
 * furniture on every storefront page and the full bundle is ~34KB. That choice
 * also rules out `layout`/`layoutId` — a true morph needs `domMax` — so the
 * open is a tuned scale rather than a measured one.
 */
export function AssistantLauncher() {
  const t = useTranslations("assistant")
  const open = useAssistantStore((s) => s.open)
  const setOpen = useAssistantStore((s) => s.setOpen)

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <m.div
              key="panel"
              className="pointer-events-auto origin-bottom"
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{
                // Firm enough to feel immediate, damped enough not to wobble —
                // a panel that bounces is a panel that looks unsure.
                type: "spring",
                stiffness: 420,
                damping: 34,
                mass: 0.7,
                opacity: { duration: 0.14 },
              }}
            >
              <AssistantPanel onClose={() => setOpen(false)} />
            </m.div>
          ) : (
            <m.button
              key="pill"
              type="button"
              onClick={() => setOpen(true)}
              className="pointer-events-auto inline-flex origin-bottom items-center gap-2 rounded-full border border-shop-hairline bg-card px-5 py-2.5 text-sm font-medium ring-1 ring-shop-hairline hover:border-shop-accent hover:text-shop-accent"
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 4 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
            >
              <Sparkles className="size-4 text-shop-accent" aria-hidden />
              {t("launcher")}
            </m.button>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  )
}
