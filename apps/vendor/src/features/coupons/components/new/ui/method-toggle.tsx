"use client"

import { Button } from "@repo/ui/components/button"
import { cn } from "@/shared/lib/utils"

export function MethodToggle({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-muted text-foreground hover:bg-muted"
          : "text-muted-foreground hover:bg-muted/40",
      )}
    >
      {children}
    </Button>
  )
}
