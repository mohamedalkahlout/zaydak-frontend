"use client"

import { createContext, useContext, useMemo, useState } from "react"
import { createPortal } from "react-dom"

/**
 * How a settings page reaches into the shell's header row.
 *
 * The shell owns the row — the section icon, the heading, the breadcrumb —
 * because it is a layout and survives navigation. But two things on that row
 * belong to the page: the actions beside the heading (Domains' "Connect
 * existing" / "Buy new domain") and, on a detail screen, the heading itself
 * (a hostname the page has to load before it can be shown). Neither can be
 * derived from the path, so the shell leaves two mount points and the page
 * portals into them.
 *
 * Portals rather than a store: the content stays in the page's own subtree,
 * so its translations, queries and dialogs are the page's, and it unmounts
 * with the page — a store would need every page to remember to clear it.
 *
 * The targets are held in state and set from callback refs, which run on
 * commit, so the first render of a page finds no target and renders nothing
 * into the header; the shell's state update then re-renders it with one. That
 * is one frame, the same one every portal-to-sibling pattern pays.
 */
interface SettingsHeaderSlots {
  title: HTMLElement | null
  actions: HTMLElement | null
}

const SlotsContext = createContext<SettingsHeaderSlots>({
  title: null,
  actions: null,
})

/** The shell's half: two setters to hand to `ref`, and the value to provide. */
export function useSettingsHeaderSlotTargets() {
  const [title, setTitle] = useState<HTMLElement | null>(null)
  const [actions, setActions] = useState<HTMLElement | null>(null)
  const slots = useMemo(() => ({ title, actions }), [title, actions])
  return { slots, setTitle, setActions }
}

export const SettingsHeaderSlotsProvider = SlotsContext.Provider

/**
 * The heading of a detail screen. Only mounted by the shell on a detail
 * path, so on any other route this renders nothing rather than somewhere odd.
 */
export function SettingsHeaderTitle({
  children,
}: {
  children: React.ReactNode
}) {
  const { title } = useContext(SlotsContext)
  return title ? createPortal(children, title) : null
}

/** The buttons at the end of the header row. */
export function SettingsHeaderActions({
  children,
}: {
  children: React.ReactNode
}) {
  const { actions } = useContext(SlotsContext)
  return actions ? createPortal(children, actions) : null
}
