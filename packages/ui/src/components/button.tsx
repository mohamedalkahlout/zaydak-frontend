"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "../lib/utils"

/**
 * A flat control: a face, a border and a focus ring, and nothing beneath it.
 *
 * There is deliberately no depth here — no ledge shadow, no top sheen and no
 * travel on press. The press reads through the face colour alone, which is the
 * one thing every variant already has. Feedback on a press belongs in `hover:`
 * and `aria-expanded:` on the variant, not in a second painted layer.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 touch-manipulation items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none [-webkit-tap-highlight-color:transparent] transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ease-out focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        outline:
          "border-border bg-card text-card-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:hover:bg-muted/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = Omit<ButtonPrimitive.Props, "ref"> &
  VariantProps<typeof buttonVariants> & {
    ref?: React.Ref<HTMLElement>
  }

/**
 * Whether the element this button will actually render is a native `<button>`.
 *
 * Base UI defaults `nativeButton` to `true`, which is only right while the
 * button renders its own `<button>`. The moment a call site passes
 * `render={<Link />}` the rendered element is an `<a>`, and the primitive both
 * warns in development and merges `type="button"` onto an anchor that has no
 * use for it — while the keyboard handling it installs is the one written for
 * a `<button>` rather than the one that defers to a link's own Enter.
 *
 * The answer is already in the `render` prop, so derive it rather than asking
 * ~190 call sites to remember a second prop. Anything that is not literally an
 * intrinsic `<button>` — a component like `Link`, an `<a>`, a `<div>` — is not
 * a native button. The function form of `render` cannot be inspected, so it
 * keeps the primitive's own default and a call site can still say outright.
 */
function rendersNativeButton(render: ButtonProps["render"]): boolean {
  if (render === undefined || !React.isValidElement(render)) {
    return true
  }
  return render.type === "button"
}

function Button({
  className,
  variant,
  size,
  ref,
  nativeButton,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      ref={ref}
      nativeButton={nativeButton ?? rendersNativeButton(props.render)}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
