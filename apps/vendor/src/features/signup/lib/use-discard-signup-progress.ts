"use client"

import { useEffect } from "react"

import { clearSignupProgress } from "./progress"

/**
 * Sign-in screens call this so Login → Create is always a fresh wizard.
 *
 * `pageshow` covers the back-forward cache: returning to `/login` without a
 * remount would otherwise leave `vendor-signup-progress` in place, and the
 * next click on "Create" would open the old pane.
 */
export function useDiscardSignupProgress() {
  useEffect(() => {
    const discard = () => clearSignupProgress()
    discard()
    window.addEventListener("pageshow", discard)
    return () => window.removeEventListener("pageshow", discard)
  }, [])
}
