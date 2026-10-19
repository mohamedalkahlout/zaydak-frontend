import { Fragment, type ReactNode } from "react"

const PLACEHOLDER = /(\{\w+\})/

/** Fills `{name}` placeholders in a copy string with text or elements. */
export function fill(template: string, values: Record<string, ReactNode>): ReactNode {
  return template.split(PLACEHOLDER).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1]
    return <Fragment key={i}>{key !== undefined && key in values ? values[key] : part}</Fragment>
  })
}

/** The same, for places that need a plain string (attributes, `aria-label`). */
export function fillText(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? values[key] : all))
}
