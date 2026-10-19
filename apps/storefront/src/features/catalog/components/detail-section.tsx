"use client"

import { ChevronDown } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible"
import { cn } from "@repo/ui/lib/utils"

/**
 * One foldable block on the product page — description, shipping, specs.
 *
 * Uncontrolled with a `defaultOpen`, because nothing outside needs to know
 * which sections are open and a controlled version would put three booleans in
 * the PDP for no reader.
 *
 * The trigger is a real `<button>` wrapping the heading rather than a heading
 * containing a button: the whole row is the target, and a shopper who taps the
 * word "Shipping" expects it to fold. `aria-expanded` comes from the primitive.
 */
export function DetailSection({
  title,
  defaultOpen = false,
  className,
  children,
}: {
  title: string
  defaultOpen?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn("border-t border-shop-hairline pt-4", className)}
    >
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="font-heading text-shop-title font-semibold tracking-tight">
          {title}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
