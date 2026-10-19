"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Switch } from "@repo/ui/components/switch"
import { Badge } from "@repo/ui/components/badge"
import { Separator } from "@repo/ui/components/separator"
import {
  ADMIN_FEATURE_CATALOG,
  ADMIN_SET_PLAN_ENTITLEMENTS,
} from "../api"
import {
  formatLimit,
  parseLimit,
  type EntitlementDraft,
} from "../validations"
import { asConfigSchema, type CapabilityRow } from "../types"
import { ConfigField } from "./config-field"

/**
 * The entitlement matrix for one plan.
 *
 * Rendered entirely from `featureCatalog`: the capability list, its grouping,
 * the unit labels and every config control come from the server. Shipping a new
 * capability costs nothing here.
 *
 * **Saves only the group that was edited.** `setPlanEntitlements` is a patch on
 * the server, so sending one group is safe — and it is the only safe thing to
 * send, since this screen never loads the rows it did not render.
 */
export function EntitlementMatrix({
  planId,
  planCode,
  initial,
}: {
  planId: string
  planCode: string
  /** Current rows for this plan, keyed by capability. */
  initial: Record<string, { enabled: boolean; limit_value?: number | null; config?: Record<string, unknown> }>
}) {
  const t = useTranslations("plans")
  const { data, loading } = useQuery(ADMIN_FEATURE_CATALOG)
  const [save, { loading: saving }] = useMutation(ADMIN_SET_PLAN_ENTITLEMENTS)
  const [drafts, setDrafts] = useState<Record<string, EntitlementDraft>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const capabilities = useMemo(
    () => data?.featureCatalog.data ?? [],
    [data],
  )

  const groups = useMemo(() => {
    const byGroup = new Map<string, CapabilityRow[]>()
    for (const c of capabilities) {
      const list = byGroup.get(c.group) ?? []
      list.push(c)
      byGroup.set(c.group, list)
    }
    return [...byGroup.entries()]
  }, [capabilities])

  /** The staged value for a capability, falling back to what the plan has. */
  const draftFor = (key: string): EntitlementDraft => {
    if (drafts[key]) return drafts[key]
    const row = initial[key]
    return {
      feature_key: key,
      enabled: row?.enabled ?? false,
      limit: formatLimit(row?.limit_value),
      config: row?.config ?? {},
    }
  }

  const patch = (key: string, next: Partial<EntitlementDraft>) => {
    setSaved(null)
    setDrafts((prev) => ({ ...prev, [key]: { ...draftFor(key), ...next } }))
  }

  const dirtyKeys = Object.keys(drafts)

  async function onSaveGroup(group: string, keys: string[]) {
    setError(null)
    const touched = keys.filter((k) => drafts[k])
    if (!touched.length) return

    const rows = []
    for (const key of touched) {
      const draft = drafts[key]!
      const limit = parseLimit(draft.limit)
      if (limit === undefined) {
        // Blocking rather than guessing: an unparseable limit written as 0
        // would cap a capability the admin meant to leave unlimited.
        setError(t("limitError", { key }))
        return
      }
      rows.push({
        feature_key: key,
        enabled: draft.enabled,
        limit_value: limit,
        config: draft.config,
      })
    }

    try {
      await save({ variables: { input: { plan_id: planId, entitlements: rows } } })
      setDrafts((prev) => {
        const next = { ...prev }
        for (const k of touched) delete next[k]
        return next
      })
      setSaved(group)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading)
    return (
      <p className="text-sm text-muted-foreground">
        {t("loadingCapabilities")}
      </p>
    )

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {groups.map(([group, caps]) => {
        const keys = caps.map((c) => c.key)
        const groupDirty = keys.some((k) => drafts[k])

        return (
          <section key={group} className="rounded-lg border">
            <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div>
                <h3 className="font-medium">{humanizeGroup(group)}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("matrix.groupMeta", { count: caps.length, code: planCode })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {saved === group && !groupDirty && (
                  <span className="text-xs text-muted-foreground">
                    {t("saved")}
                  </span>
                )}
                <Button
                  size="sm"
                  disabled={!groupDirty || saving}
                  onClick={() => void onSaveGroup(group, keys)}
                >
                  {saving ? t("saving") : t("saveGroup")}
                </Button>
              </div>
            </header>

            <div className="divide-y">
              {caps.map((cap) => {
                const draft = draftFor(cap.key)
                const schema = asConfigSchema(cap.config_schema)
                const props = Object.entries(schema?.properties ?? {})
                const isBoolean = cap.kind === "BOOLEAN"

                return (
                  <div key={cap.key} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{cap.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {cap.kind}
                          </Badge>
                          {cap.is_estimated && (
                            <Badge variant="outline" className="text-[10px]">
                              {t("matrix.estimated")}
                            </Badge>
                          )}
                          {drafts[cap.key] && (
                            <Badge className="text-[10px]">
                              {t("unsaved")}
                            </Badge>
                          )}
                        </div>
                        <code className="text-xs text-muted-foreground">{cap.key}</code>
                      </div>

                      <div className="flex items-center gap-4">
                        {/*
                          A LIMIT/QUOTA row keeps its limit box even when
                          disabled, so an admin can set the ceiling and flip the
                          switch in either order. BOOLEAN has no box at all —
                          the server forces null there regardless.
                        */}
                        {!isBoolean && (
                          <div className="flex items-center gap-2">
                            <Input
                              className="h-8 w-28"
                              placeholder={t("matrix.unlimitedPlaceholder")}
                              value={draft.limit}
                              onChange={(e) => patch(cap.key, { limit: e.target.value })}
                            />
                            <span className="w-16 text-xs text-muted-foreground">
                              {unitLabel(cap.billing_unit, cap.period)}
                            </span>
                          </div>
                        )}
                        <Switch
                          checked={draft.enabled}
                          onCheckedChange={(enabled) => patch(cap.key, { enabled })}
                        />
                      </div>
                    </div>

                    {props.length > 0 && draft.enabled && (
                      <>
                        <Separator className="my-3" />
                        <div className="grid gap-1 sm:grid-cols-2">
                          {props.map(([name, prop]) => (
                            <ConfigField
                              key={name}
                              name={name}
                              schema={prop}
                              value={draft.config[name]}
                              onChange={(next) =>
                                patch(cap.key, {
                                  config:
                                    next === undefined
                                      ? omit(draft.config, name)
                                      : { ...draft.config, [name]: next },
                                })
                              }
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {dirtyKeys.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("unsavedCount", { count: dirtyKeys.length })}
        </p>
      )}
    </div>
  )
}

function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const { [key]: _drop, ...rest } = obj
  return rest
}

/** "unlimited" is the empty state, so the unit only labels what a number means. */
function unitLabel(unit: string, period: string): string {
  if (unit === "none") return ""
  const per = period === "NONE" ? "" : ` / ${period.toLowerCase()}`
  return `${unit}${per}`
}

function humanizeGroup(group: string): string {
  return group
    .replace(/[_-]+/g, " ")
    .replace(/^ai /, "AI ")
    .replace(/^./, (c) => c.toUpperCase())
}
