"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useApolloClient } from "@apollo/client/react"
import {
  CheckCircle2Icon,
  Loader2Icon,
  MapPinIcon,
  XCircleIcon,
} from "lucide-react"

import { Input } from "@repo/ui/components/input"
import { Field, FieldLabel } from "@repo/ui/components/field"
import { cn } from "@repo/ui/lib/utils"

import { LOOKUP_NATIONAL_ADDRESS } from "@/features/shipping/providers-api"
import type { ResolvedAddressResponse } from "@/features/shipping/providers-types"

/** Four letters then four digits — the printed shape of the code. */
const SHAPE = /^[A-Z]{4}\d{4}$/

/**
 * The Saudi National Address code, with the address it resolves to shown
 * underneath.
 *
 * **The preview is the whole point.** Eight characters are easy to mistype and
 * impossible to eyeball, and the cost of a wrong one is a courier at somebody
 * else's gate — found days later, on a real shipment, by a customer. So the
 * code is resolved against the official registry as the merchant types, and
 * what comes back is the address a driver will actually be sent to.
 *
 * Three details that are deliberate:
 *
 * - **Status is DERIVED, never stored.** The only state here is the answer for
 *   one specific code; everything the user sees follows from comparing that
 *   code to what is currently typed. That is what keeps a stale verdict from
 *   ever being shown — a corrected code cannot inherit the previous one's
 *   green tick, because the stored answer no longer matches the input. It also
 *   means no state is set synchronously inside an effect, which the React
 *   Compiler rules forbid for exactly this class of bug.
 * - **It only asks once the shape is complete.** There is no reason to ask the
 *   server about `RG`, and doing so would leave "not found" showing for most
 *   of the time someone is typing.
 * - **Not found is guidance, not an error.** The merchant has a real code —
 *   they just typed it wrong — so the message says where to look it up.
 */
export function NationalAddressField({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const t = useTranslations("inventory.nationalAddress")
  const client = useApolloClient()

  /** The registry's answer for ONE code. `formatted: null` means not found. */
  const [answer, setAnswer] = useState<{
    code: string
    formatted: string | null
  } | null>(null)

  const code = value.trim().toUpperCase()
  const complete = SHAPE.test(code)

  // Everything rendered follows from this comparison — no status state, so no
  // way for the two to disagree.
  const status: "idle" | "checking" | "found" | "notFound" = !complete
    ? "idle"
    : answer?.code !== code
      ? "checking"
      : answer.formatted
        ? "found"
        : "notFound"

  useEffect(() => {
    if (!complete) return

    // Debounced, and cancelled on the next keystroke. `cancelled` also guards
    // the response: a slow answer for an abandoned code must not land.
    let cancelled = false
    const timer = setTimeout(() => {
      void client
        .query<ResolvedAddressResponse>({
          query: LOOKUP_NATIONAL_ADDRESS,
          variables: { input: { code } },
          // The registry is authoritative and its answers are stable, so
          // re-typing a code already checked is served from cache.
          fetchPolicy: "cache-first",
        })
        .then((res) => {
          if (cancelled) return
          const data = res.data?.lookupNationalAddress?.data
          setAnswer({ code, formatted: data?.formatted ?? null })
        })
        .catch(() => {
          if (cancelled) return
          setAnswer({ code, formatted: null })
        })
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [client, code, complete])

  return (
    <Field>
      <FieldLabel htmlFor="loc-national-address">{t("label")}</FieldLabel>

      <div className="relative">
        <Input
          id="loc-national-address"
          placeholder="RGUC8214"
          value={value}
          maxLength={8}
          autoComplete="off"
          spellCheck={false}
          // Uppercased on entry so the field reads the way the code is
          // printed. The transform is length-preserving, so the caret stays.
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className={cn(
            "pr-9 font-mono tracking-[0.14em] uppercase",
            status === "found" && "border-emerald-500/60",
            status === "notFound" && "border-destructive/60",
          )}
          aria-describedby="loc-national-address-hint"
          aria-invalid={status === "notFound"}
        />

        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          {status === "checking" && (
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          )}
          {status === "found" && (
            <CheckCircle2Icon className="size-4 text-emerald-600" />
          )}
          {status === "notFound" && (
            <XCircleIcon className="size-4 text-destructive" />
          )}
        </span>
      </div>

      {/*
        One line, always present. `aria-live` announces the verdict to a screen
        reader, and the reserved height stops the dialog jumping as the state
        moves between hint, address and error.
      */}
      <p
        id="loc-national-address-hint"
        aria-live="polite"
        className="min-h-5 text-xs"
      >
        {status === "found" && answer?.formatted ? (
          <span className="flex items-start gap-1.5 text-muted-foreground">
            <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            <span>{answer.formatted}</span>
          </span>
        ) : status === "notFound" ? (
          <span className="text-destructive">{t("notFound")}</span>
        ) : (
          <span className="text-muted-foreground">{t("hint")}</span>
        )}
      </p>
    </Field>
  )
}
