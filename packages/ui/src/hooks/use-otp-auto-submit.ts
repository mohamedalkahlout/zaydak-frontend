"use client"

import { useCallback, useRef } from "react"

/**
 * Submit an OTP the moment the last slot is filled.
 *
 * Fires from the input's `onChange`, not from an effect and not from the
 * `input-otp` package's `onComplete` (that one is itself an effect). A paste
 * and a typed last digit both hit `onChange` with the complete string, which
 * is the event the Verify button would have waited for.
 *
 * Double-submit is two races, and each has its own lock:
 * - the same complete value arriving twice (paste + a duplicate change) is
 *   latched until the value becomes incomplete again
 * - the Verify button while that request is in flight is a synchronous
 *   `submitOnce` lock around the mutation
 */
export function useOtpAutoSubmit(length: number) {
  const lastComplete = useRef<string | null>(null)
  const inflight = useRef(false)

  const onCodeChange = useCallback(
    (value: string, submit: () => void) => {
      if (value.length < length) {
        lastComplete.current = null
        return
      }
      if (value.length !== length) return
      if (!/^\d+$/.test(value)) return
      if (lastComplete.current === value) return
      lastComplete.current = value
      submit()
    },
    [length],
  )

  const submitOnce = useCallback(async (job: () => Promise<void>) => {
    if (inflight.current) return
    inflight.current = true
    try {
      await job()
    } finally {
      inflight.current = false
    }
  }, [])

  return { onCodeChange, submitOnce }
}
