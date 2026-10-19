"use client"

import type { ReactNode } from "react"

/** Wraps a hullo checkout in the faces the app already loaded. */
export function HulloFontScope({ fonts, children }: { fonts: string; children: ReactNode }) {
  return <div className={fonts}>{children}</div>
}
