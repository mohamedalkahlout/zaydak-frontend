"use client"

import { useTranslations } from "next-intl"
import { CheckIcon, LoaderIcon } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import type { StoreImportStatus } from "@/features/products/api"
import {
  STORE_IMPORT_LADDER,
  ladderStepState,
} from "@/features/products/lib/store-import"

/**
 * The seven rungs a store import climbs, and which one it is on.
 *
 * Every rung is on screen from the first paint, including the ones still to
 * come: an import runs for minutes with nothing else to look at, and a list
 * that grows a step at a time gives a merchant no idea whether they are a
 * third of the way through or nearly done.
 *
 * READY is drawn like any other rung and is not: it is where the scan *stops*
 * and waits to be approved. The approval card below it is what says so — the
 * ladder's job is only to say where the work got to.
 */
export function StoreImportLadder({ status }: { status: StoreImportStatus }) {
  const t = useTranslations("products.import.progress")
  const stopped = status === "FAILED" || status === "CANCELLED"

  return (
    <ol className="flex flex-col gap-0">
      {STORE_IMPORT_LADDER.map((step, index) => {
        const state = ladderStepState(status, step)
        return (
          <li key={step} className="flex items-start gap-3">
            <div className="flex flex-col items-center self-stretch">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium",
                  state === "done" &&
                    "border-primary bg-primary text-primary-foreground",
                  state === "active" &&
                    !stopped &&
                    "border-primary text-primary",
                  (state === "pending" || stopped) &&
                    state !== "done" &&
                    "border-border text-muted-foreground",
                )}
              >
                {state === "done" ? (
                  <CheckIcon className="size-3.5" />
                ) : state === "active" && !stopped ? (
                  <LoaderIcon className="size-3.5 animate-spin" />
                ) : (
                  index + 1
                )}
              </span>
              {index < STORE_IMPORT_LADDER.length - 1 && (
                <span
                  className={cn(
                    "w-px flex-1 bg-border",
                    state === "done" && "bg-primary/40",
                  )}
                />
              )}
            </div>
            <span
              className={cn(
                "pb-4 text-sm",
                state === "pending" && "text-muted-foreground",
                state === "active" && !stopped && "font-medium",
              )}
            >
              {t(`steps.${step}`)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
