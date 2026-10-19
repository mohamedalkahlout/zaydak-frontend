"use client"

import type { CSSProperties, ReactNode } from "react"

/** Wraps a doughn checkout in the faces the app already loaded. */
export function DoughnFontScope({ fonts, children }: { fonts: CSSProperties; children: ReactNode }) {
  return <div style={fonts}>{children}</div>
}
