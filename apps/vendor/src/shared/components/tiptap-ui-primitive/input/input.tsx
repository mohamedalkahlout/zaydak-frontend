"use client"

import { cn } from "@/shared/lib/tiptap-utils"
import "@/shared/components/tiptap-ui-primitive/input/input.scss"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="tiptap-input"
      className={cn("tiptap-input", className)}
      {...props}
    />
  )
}

export { Input }
