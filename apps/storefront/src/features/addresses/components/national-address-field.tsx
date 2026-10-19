"use client"

import { memo, useEffect, useState } from "react"
import { useApolloClient } from "@apollo/client/react"
import { useTranslations } from "next-intl"

import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { cn } from "@repo/ui/lib/utils"

import { LOOKUP_NATIONAL_ADDRESS } from "../api"
import type { LookupNationalAddressResult } from "../api"
import {
  NATIONAL_ADDRESS_SHAPE,
  type ResolvedNationalAddress,
} from "../lib/address"

/**
 * The customer's National Address code, and the address it resolves to.
 *
 * **This is the address form.** The code is the only thing typed; the city,
 * country, street and postcode all come back from the registry and are what
 * the order actually ships against — see `lib/address.ts` for why the typed
 * fields went away.
 *
 * That makes the lookup load-bearing rather than a nicety, and the component
 * reports it in both directions: `onResolve(resolved)` when the registry knows
 * the code, `onResolve(null)` when it does not. A caller that never hears the
 * first one has an address it must not check out with, which is the honest
 * reading of "the registry has no such address".
 *
 * Status is DERIVED from comparing the stored answer's code to what is typed,
 * so a corrected code can never inherit the previous one's verdict — the bug
 * that shape most reliably produces.
 */
export const NationalAddressField = memo(function NationalAddressField({
  value,
  onChange,
  onResolve,
  id,
  disabled,
  inputClassName,
}: {
  value: string
  onChange: (next: string) => void
  /** The registry's answer for the current code, or null when it has none. */
  onResolve: (resolved: ResolvedNationalAddress | null) => void
  id: string
  disabled?: boolean
  inputClassName?: string
}) {
  const t = useTranslations("addresses")
  const client = useApolloClient()

  /** The registry's answer for ONE code. `formatted: null` means unrecognised. */
  const [answer, setAnswer] = useState<{
    code: string
    formatted: string | null
  } | null>(null)

  const code = value.trim().toUpperCase()
  const complete = NATIONAL_ADDRESS_SHAPE.test(code)

  const status: "idle" | "checking" | "found" | "unknown" = !complete
    ? "idle"
    : answer?.code !== code
      ? "checking"
      : answer.formatted
        ? "found"
        : "unknown"

  // The latest callback, read inside the effect below rather than listed as a
  // dependency. A parent that rebuilds `onResolve` every render would
  // otherwise re-run the lookup on every keystroke elsewhere in the form.
  const [resolveRef] = useState(() => ({
    current: onResolve,
  }))
  useEffect(() => {
    resolveRef.current = onResolve
  }, [onResolve, resolveRef])

  useEffect(() => {
    if (!complete) return

    let cancelled = false
    const timer = setTimeout(() => {
      void client
        .query<LookupNationalAddressResult>({
          query: LOOKUP_NATIONAL_ADDRESS,
          variables: { input: { code } },
          // Stable, authoritative answers — re-typing a checked code should not
          // re-ask, and the lookup is throttled per caller on the server.
          fetchPolicy: "cache-first",
        })
        .then((res) => {
          if (cancelled) return
          const data = res.data?.lookupNationalAddress?.data
          setAnswer({ code, formatted: data?.formatted ?? null })
          resolveRef.current(
            data?.city
              ? {
                city: data.city,
                country: data.country,
                formatted: data.formatted,
                street: data.street,
                district: data.district,
                building_number: data.building_number,
                postcode: data.postcode,
              }
              : null,
          )
        })
        .catch(() => {
          if (cancelled) return
          // Includes "not signed in" and "rate limited" as well as a genuinely
          // unknown code. All three land on the same message, because all three
          // leave the customer with the same problem: no address to ship to.
          setAnswer({ code, formatted: null })
          resolveRef.current(null)
        })
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [client, code, complete, resolveRef])

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-shop-muted text-xs font-medium">
        {t("nationalAddress")}
      </Label>

      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder="RGUC8214"
        maxLength={8}
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className={cn(
          "font-mono text-base uppercase tracking-[0.14em]",
          status === "found" && "border-emerald-500/60",
          status === "unknown" && "border-destructive/60",
          inputClassName,
        )}
        aria-describedby={`${id}-hint`}
        aria-invalid={status === "unknown"}
      />

      {/*
        Reserved height so the form does not jump between states, and
        `aria-live` so the resolved address is announced rather than only seen.
        It is the only confirmation the customer gets that they typed the right
        eight characters — nothing else on the screen names the street.
      */}
      <p id={`${id}-hint`} aria-live="polite" className="min-h-8 text-xs">
        {status === "found" && answer?.formatted ? (
          <span className="text-emerald-600">
            {answer.formatted}
          </span>
        ) : status === "checking" ? (
          <span className="text-shop-muted">{t("nationalAddressChecking")}</span>
        ) : status === "unknown" ? (
          <span className="text-destructive">{t("nationalAddressUnknown")}</span>
        ) : (
          <span className="text-shop-muted">{t("nationalAddressHint")}</span>
        )}
      </p>
    </div>
  )
})
