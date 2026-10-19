"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Switch } from "@repo/ui/components/switch"
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@/shared/lib/utils"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import {
  NOTIFICATION_PREFERENCES,
  UPDATE_NOTIFICATION_PREFERENCE,
} from "../api"
import { NOTIFY_TYPES, iconForType, toneForType } from "../lib/notify-type"
import type {
  NotificationPreferenceEntry,
  NotificationPreferencesResult,
  NotifyTypeValue,
  UpdatePreferenceResult,
} from "../types"

type Channels = { in_app: boolean; email: boolean }
type Draft = Record<string, Channels>

/** Server defaults, used for a type the back-end has no stored row for yet. */
const FALLBACK: Channels = { in_app: true, email: false }

function toDraft(rows: NotificationPreferenceEntry[]): Draft {
  const map: Draft = {}
  for (const type of NOTIFY_TYPES) {
    const row = rows.find((r) => r.notify_type === type)
    map[type] = {
      in_app: row?.in_app ?? FALLBACK.in_app,
      email: row?.email ?? FALLBACK.email,
    }
  }
  return map
}

/**
 * Per-type delivery matrix for the signed-in user (in-app / email). Preferences
 * are per-person, not per-shop, so this screen is identical in every store.
 *
 * Toggles stage into a local draft and persist only on Save in the global
 * contextual bar. The back-end takes one type per call, so Save fans out one
 * mutation per changed row — still a single explicit user action.
 */
export function NotificationPreferences() {
  const t = useTranslations("notifications")
  const show = useUnsavedBarStore((s) => s.show)
  const hide = useUnsavedBarStore((s) => s.hide)
  const setError = useUnsavedBarStore((s) => s.setError)

  const { data, loading, refetch } = useQuery<NotificationPreferencesResult>(
    NOTIFICATION_PREFERENCES,
    { fetchPolicy: "cache-and-network" },
  )
  const [update] = useMutation<UpdatePreferenceResult>(
    UPDATE_NOTIFICATION_PREFERENCE,
  )

  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const server = useMemo(
    () => (data ? toDraft(data.notificationPreferences.data) : null),
    [data],
  )

  // Adopt the server snapshot the moment it arrives. Adjusted during render
  // rather than from an effect: React re-runs this component immediately with
  // the toggles populated, where an effect would first commit a frame of empty
  // switches. An edit in flight is never clobbered — this only fires while
  // there is no draft at all.
  if (server && draft === null) setDraft(server)

  const changed = useMemo(() => {
    if (!draft || !server) return [] as NotifyTypeValue[]
    return NOTIFY_TYPES.filter(
      (type) =>
        draft[type]?.in_app !== server[type]?.in_app ||
        draft[type]?.email !== server[type]?.email,
    )
  }, [draft, server])

  const dirty = changed.length > 0

  async function save() {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      await Promise.all(
        changed.map((type) =>
          update({
            variables: {
              input: {
                notify_type: type,
                in_app: draft[type]!.in_app,
                email: draft[type]!.email,
              },
            },
          }),
        ),
      )
      const next = await refetch()
      const rows = next.data?.notificationPreferences.data
      if (rows) setDraft(toDraft(rows))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!dirty) {
      hide()
      return
    }
    show({
      label: t("unsavedChanges"),
      saving,
      onSave: () => void save(),
      onDiscard: () => setDraft(server),
    })
    // `save` closes over the current draft, so re-register whenever it moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, draft, server])

  useEffect(() => () => hide(), [hide])

  function toggle(type: NotifyTypeValue, channel: keyof Channels, on: boolean) {
    setDraft((prev) =>
      prev ? { ...prev, [type]: { ...prev[type]!, [channel]: on } } : prev,
    )
  }

  if (loading && !draft) {
    return (
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="my-3 h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!draft) return null

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("prefs.intro")}</p>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="flex items-center gap-4 border-b border-border px-4 py-2.5">
          {/* Stands in for the row's icon puck so the heading keeps sitting
              over the labels underneath it. */}
          <span className="size-8 shrink-0" aria-hidden />
          <span className="flex-1 text-xs font-medium text-muted-foreground">
            {t("hub.typesTitle")}
          </span>
          <span className="w-16 text-center text-xs font-medium text-muted-foreground">
            {t("hub.colInApp")}
          </span>
          <span className="w-16 text-center text-xs font-medium text-muted-foreground">
            {t("hub.colEmail")}
          </span>
        </div>

        <ul className="divide-y divide-border">
          {NOTIFY_TYPES.map((type) => {
            const label = t(`types.${type}`)
            const row = draft[type]!
            const Icon = iconForType(type)
            const tone = toneForType(type)
            return (
              <li key={type} className="flex items-center gap-4 px-4 py-3.5">
                {/* The same puck the bell and the inbox draw, so a type is
                    recognised here by the colour it will arrive in. */}
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-black/5 dark:ring-white/10",
                    tone.chip,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {t(`typeDesc.${type}`)}
                  </span>
                </div>
                <div className="flex w-16 justify-center">
                  <Switch
                    checked={row.in_app}
                    onCheckedChange={(on) => toggle(type, "in_app", on)}
                    aria-label={t("prefs.inAppFor", { type: label })}
                  />
                </div>
                <div className="flex w-16 justify-center">
                  <Switch
                    checked={row.email}
                    onCheckedChange={(on) => toggle(type, "email", on)}
                    aria-label={t("prefs.emailFor", { type: label })}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">{t("hub.deliveryEmail")}</p>
    </div>
  )
}
