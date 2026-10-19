"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { formatDate } from "@/shared/lib/format"
import {
  ADMIN_FEATURE_CATALOG,
  ADMIN_SET_SUBSCRIPTION_OVERRIDE,
  ADMIN_SHOP_OVERRIDES,
} from "../api"
import { formatLimit, parseLimit } from "../validations"
import { ActionResult } from "./detail-shell"

/** What an override may say about `enabled`, including "say nothing". */
type EnabledChoice = "inherit" | "on" | "off"

/**
 * Per-store grants on top of the plan.
 *
 * `setSubscriptionOverride` and `shopOverrides` have existed on the server
 * since the admin API shipped and **had no UI at all** — the one thing support
 * needs when a store asks for a higher cap for a busy month was reachable only
 * from a GraphQL client. The vendor plan screen even tells them to ask
 * ("Support can raise it without changing your plan").
 *
 * Two rules the form is built around, both the server's. Every value is
 * optional and independent — an override may move the limit, the flag, or
 * neither — so an untouched field must send **nothing** rather than a value it
 * guessed. And clearing every value **removes** the row, because an override
 * that overrides nothing is a row that outlives its reason.
 */
export function SubscriptionOverrides({ shopId }: { shopId: string }) {
  const t = useTranslations("plans")
  const locale = useLocale()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const { data, loading, refetch } = useQuery(ADMIN_SHOP_OVERRIDES, {
    variables: { shop_id: shopId },
    fetchPolicy: "cache-and-network",
  })
  const { data: catalogData } = useQuery(ADMIN_FEATURE_CATALOG)
  const [save, { loading: saving }] = useMutation(
    ADMIN_SET_SUBSCRIPTION_OVERRIDE,
  )

  const overrides = data?.shopOverrides.data ?? []
  const capabilities = catalogData?.featureCatalog.data ?? []
  const nameOf = (key: string) =>
    capabilities.find((c) => c.key === key)?.name ?? key

  async function submit(
    input: { feature_key: string } & Record<string, unknown>,
    success: string,
  ): Promise<void> {
    setError(null)
    setNotice(null)
    try {
      await save({ variables: { input: { shop_id: shopId, ...input } } })
      await refetch()
      setNotice(success)
      setAdding(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">{t("overridesTitle")}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            {t("overridesHint")}
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          {t("addOverride")}
        </Button>
      </div>

      <ActionResult error={error} notice={notice} />

      {adding && (
        <OverrideForm
          capabilities={capabilities.map((c) => ({ key: c.key, name: c.name }))}
          saving={saving}
          onCancel={() => setAdding(false)}
          onSubmit={(input) => void submit(input, t("overrideSavedOk"))}
        />
      )}

      {!loading && overrides.length === 0 && !adding && (
        <p className="rounded-xl bg-card px-5 py-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
          {t("overridesEmpty")}
        </p>
      )}

      {overrides.length > 0 && (
        <ul className="space-y-2">
          {overrides.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-baseline justify-between gap-4 rounded-xl bg-card px-5 py-4 ring-1 ring-foreground/10"
            >
              <div className="min-w-0">
                <p className="font-medium">{nameOf(row.feature_key)}</p>
                <code className="text-xs text-muted-foreground">
                  {row.feature_key}
                </code>
                {row.note && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.note}
                  </p>
                )}
              </div>

              <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                <div className="flex items-baseline gap-2">
                  <dt className="text-xs text-muted-foreground">
                    {t("overrideEnabled")}
                  </dt>
                  <dd className="tabular-nums">
                    {row.enabled === null || row.enabled === undefined
                      ? "—"
                      : row.enabled
                        ? t("on")
                        : t("off")}
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="text-xs text-muted-foreground">
                    {t("overrideLimit")}
                  </dt>
                  {/* Null is "inherit the plan's limit" here, NOT unlimited —
                      an override that says nothing about the limit leaves the
                      plan's in force. */}
                  <dd className="tabular-nums">
                    {row.limit_value === null || row.limit_value === undefined
                      ? "—"
                      : row.limit_value}
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="text-xs text-muted-foreground">
                    {t("col.expires")}
                  </dt>
                  <dd>{formatDate(row.expires_at, locale)}</dd>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  onClick={() =>
                    // Every value cleared: the server removes the row rather
                    // than storing an override that overrides nothing.
                    void submit(
                      { feature_key: row.feature_key },
                      t("overrideRemovedOk"),
                    )
                  }
                >
                  {t("removeOverride")}
                </Button>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        {t("overrideRemoveHint")}
      </p>
    </div>
  )
}

/** The add form. Every field independently optional, like the mutation. */
function OverrideForm({
  capabilities,
  saving,
  onCancel,
  onSubmit,
}: {
  capabilities: { key: string; name: string }[]
  saving: boolean
  onCancel: () => void
  onSubmit: (input: { feature_key: string } & Record<string, unknown>) => void
}) {
  const t = useTranslations("plans")
  const [featureKey, setFeatureKey] = useState(capabilities[0]?.key ?? "")
  const [enabled, setEnabled] = useState<EnabledChoice>("inherit")
  const [limit, setLimit] = useState("")
  const [expires, setExpires] = useState("")
  const [note, setNote] = useState("")
  const [limitError, setLimitError] = useState<string | null>(null)

  const submit = () => {
    // Blocking rather than guessing: an unparseable limit written as 0 would
    // cap a capability the admin meant to leave on the plan's own ceiling.
    const parsed = limit.trim() === "" ? null : parseLimit(limit)
    if (parsed === undefined) {
      setLimitError(t("limitError", { key: featureKey }))
      return
    }
    setLimitError(null)

    onSubmit({
      feature_key: featureKey,
      // `undefined` omits the field, which is how "leave it to the plan" is
      // spelled on the wire. `null` would be a value.
      ...(enabled === "inherit" ? {} : { enabled: enabled === "on" }),
      ...(parsed === null ? {} : { limit_value: parsed }),
      ...(expires ? { expires_at: new Date(expires).toISOString() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    })
  }

  return (
    <section className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("col.capability")}</Label>
          <Select
            value={featureKey}
            onValueChange={(v) => v && setFeatureKey(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t("overrideEnabled")}</Label>
          <Select
            value={enabled}
            onValueChange={(v) => v && setEnabled(v as EnabledChoice)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">{t("inherit")}</SelectItem>
              <SelectItem value="on">{t("on")}</SelectItem>
              <SelectItem value="off">{t("off")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t("overrideLimit")}</Label>
          <Input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            inputMode="numeric"
            placeholder={formatLimit(null) || t("inherit")}
          />
          <p className="text-xs text-muted-foreground">
            {t("overrideLimitHint")}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>{t("overrideExpires")}</Label>
          <Input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("col.note")}</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("noteWhy")}
          />
        </div>
      </div>

      {limitError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {limitError}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" disabled={saving || !featureKey} onClick={submit}>
          {saving ? t("saving") : t("save")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t("close")}
        </Button>
      </div>
    </section>
  )
}
