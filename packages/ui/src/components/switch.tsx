"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "../lib/utils"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-[22px] w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-muted-foreground/30 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary",
        // Which way the thumb travels. The track is a flex row, so the thumb
        // already rests on the *inline* start edge — the right one under RTL —
        // but `translateX` is rightward in both scripts, so unchecked it was
        // nudged 2px past the track's end and checked it left the track
        // entirely. The sign lives here once rather than in the two offsets
        // below; same shape as the storefront's `--seg-dir`.
        "[--switch-dir:1] rtl:[--switch-dir:-1]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-[18px] translate-x-[calc(0.125rem*var(--switch-dir,1))] rounded-full bg-background shadow-sm ring-0 transition-transform data-checked:translate-x-[calc(18px*var(--switch-dir,1))]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
