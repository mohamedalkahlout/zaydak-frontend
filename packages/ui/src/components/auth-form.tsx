import * as React from "react"

import { cn } from "../lib/utils"
import { Button } from "./button"
import { Input } from "./input"
import { InputOTPGroup, InputOTPSlot } from "./input-otp"

/**
 * The entry screens' form vocabulary, at the signup wizard's scale: one
 * question per card, so the control is the card — a size up from the dense
 * dashboard controls, without forking the system underneath. Each piece wraps
 * the shared primitive, so tokens, focus ring and invalid states all come
 * along.
 *
 * Compose with the ordinary `Field`/`FieldLabel`/`FieldError` — only the
 * controls change size, not the field plumbing.
 */

export function AuthInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn("h-14 rounded-xl px-4 text-base md:text-base", className)}
      {...props}
    />
  )
}

/** The card's one big action. `type="submit"` unless overridden. */
export function AuthSubmit({
  className,
  type = "submit",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type={type}
      className={cn("h-14 w-full rounded-xl text-base font-medium", className)}
      {...props}
    />
  )
}

/**
 * Separated code boxes rather than the joined default — the code is the whole
 * question on the screens that ask for one. `dir="ltr"` always: a code reads
 * left-to-right in either locale, like the one in the message.
 */
export function AuthOtpGroup({
  className,
  ...props
}: React.ComponentProps<typeof InputOTPGroup>) {
  return <InputOTPGroup dir="ltr" className={cn("gap-2", className)} {...props} />
}

export function AuthOtpSlot({
  className,
  ...props
}: React.ComponentProps<typeof InputOTPSlot>) {
  return (
    <InputOTPSlot
      className={cn("size-12 rounded-xl border border-input text-lg", className)}
      {...props}
    />
  )
}
