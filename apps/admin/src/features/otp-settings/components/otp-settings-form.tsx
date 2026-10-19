"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { KeyRoundIcon, MailIcon, MessageSquareIcon, SendIcon } from "lucide-react"
import { sileo } from "sileo"

import { Badge } from "@repo/ui/components/badge"
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
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@repo/ui/lib/utils"

import type { OtpChannel } from "@/shared/api/generated/graphql"
import { OTP_SETTINGS, UPDATE_OTP_SETTINGS } from "../api"
import {
  OTP_CHANNELS,
  OTP_LIMITS,
  OTP_NUMERIC_FIELDS,
  changedKeys,
  clampToLimits,
  formatSeconds,
  isRevealSupported,
  type OtpNumericField,
  type OtpSettingsDraft,
} from "../types"

const CHANNEL_ICONS = {
  EMAIL: MailIcon,
  SMS: MessageSquareIcon,
  BOTH: SendIcon,
} as const

/** The server row, narrowed to the fields this form owns. Shared so the draft
 *  seed and the dirty-comparison baseline cannot drift apart. */
function toDraft(server: {
  code_length: number
  ttl_seconds: number
  cooldown_seconds: number
  max_attempts: number
  daily_limit: number
  shop_hourly_limit: number
  lockout_minutes: number
  channel: OtpSettingsDraft["channel"]
}): OtpSettingsDraft {
  return {
    code_length: server.code_length,
    ttl_seconds: server.ttl_seconds,
    cooldown_seconds: server.cooldown_seconds,
    max_attempts: server.max_attempts,
    daily_limit: server.daily_limit,
    shop_hourly_limit: server.shop_hourly_limit,
    lockout_minutes: server.lockout_minutes,
    channel: server.channel,
  }
}

/**
 * The platform's one-time-code settings: how long a code is, how long it lives,
 * how often one can be asked for, and where it is delivered.
 *
 * One form, one Save — the values are read together and mean little apart, and
 * a per-field autosave on a security control is a way to half-apply a policy.
 * Only the fields that actually changed are sent, so two admins editing
 * different halves of this screen do not overwrite each other.
 */
export function OtpSettingsForm() {
  const t = useTranslations("otpSettings")
  const { data, loading, refetch } = useQuery(OTP_SETTINGS)
  const [save, { loading: saving }] = useMutation(UPDATE_OTP_SETTINGS)

  const server = data?.otpSettings.data
  const [draft, setDraft] = useState<OtpSettingsDraft | null>(null)
  const [syncedFrom, setSyncedFrom] = useState<typeof server>(undefined)

  // Resync when the server answers — and only then. Editing does not refetch,
  // so this cannot land on top of what the admin is currently typing.
  //
  // Adjusted DURING render rather than in an effect, which is React's own
  // "you might not need an effect" pattern for resetting state when an input
  // changes: React re-runs this component immediately without committing the
  // stale draft, whereas the effect version painted one frame of old values
  // and cost a cascading render for every server answer.
  if (server && server !== syncedFrom) {
    setSyncedFrom(server)
    setDraft(toDraft(server))
  }

  if (loading || !draft || !server) return <FormSkeleton />

  const serverDraft = toDraft(server)

  const changed = changedKeys(draft, serverDraft)
  const dirty = changed.length > 0

  const onSave = async () => {
    try {
      await save({
        variables: {
          input: Object.fromEntries(changed.map((key) => [key, draft[key]])),
        },
      })
      await refetch()
      sileo.success({ title: t("saved"), description: t("savedDesc") })
    } catch {
      // The error link already surfaces the server-translated message.
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <header className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRoundIcon className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold">{t("title")}</h1>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
          {/* Until an admin saves once, the values shown are the built-in
              defaults rather than anyone's decision — worth saying out loud. */}
          <Badge variant={server.is_customized ? "secondary" : "outline"}>
            {server.is_customized ? t("customized") : t("usingDefaults")}
          </Badge>
        </header>
      </section>

      <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div>
          <h2 className="text-sm font-semibold">{t("channel.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("channel.help")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {OTP_CHANNELS.map((channel) => {
            const Icon = CHANNEL_ICONS[channel]
            const active = draft.channel === channel
            return (
              <button
                key={channel}
                type="button"
                onClick={() => setDraft({ ...draft, channel: channel as OtpChannel })}
                aria-pressed={active}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-start transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-foreground/10 hover:bg-muted/50",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {t(`channel.options.${channel}.label`)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`channel.options.${channel}.help`)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {/* The channel cannot override an identifier-driven flow, and an admin
            who expects it to would file a bug against a working system. */}
        <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          {t("channel.scopeNote")}
        </p>
      </section>

      <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div>
          <h2 className="text-sm font-semibold">{t("code.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("code.help")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {OTP_NUMERIC_FIELDS.map((field) => (
            <NumericField
              key={field}
              field={field}
              value={draft[field]}
              changed={changed.includes(field)}
              label={t(`fields.${field}.label`)}
              help={t(`fields.${field}.help`)}
              hint={
                field === "ttl_seconds" || field === "cooldown_seconds"
                  ? formatSeconds(draft[field])
                  : undefined
              }
              onChange={(value) => setDraft({ ...draft, [field]: value })}
            />
          ))}
        </div>

        {/* Keyed off the draft, not the server row: the warning has to appear
            while the admin is choosing 7, not after they have saved it and
            gone looking for the button that stopped working. */}
        {!isRevealSupported(draft.code_length) ? (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
          >
            {t("code.revealWarning", { length: draft.code_length })}
          </p>
        ) : null}
      </section>

      <div className="flex items-center justify-end gap-3">
        {dirty ? (
          <p className="text-xs text-muted-foreground">
            {t("unsaved", { count: changed.length })}
          </p>
        ) : null}
        <Button
          variant="outline"
          disabled={!dirty || saving}
          onClick={() => setDraft(serverDraft)}
        >
          {t("discard")}
        </Button>
        <Button disabled={!dirty || saving} onClick={onSave}>
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  )
}

function NumericField({
  field,
  value,
  changed,
  label,
  help,
  hint,
  onChange,
}: {
  field: OtpNumericField
  value: number
  changed: boolean
  label: string
  help: string
  hint?: string
  onChange: (value: number) => void
}) {
  const { min, max } = OTP_LIMITS[field]

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`otp-${field}`} className="text-sm">
        {label}
        {changed ? (
          <span className="ms-2 size-1.5 rounded-full bg-primary" aria-hidden />
        ) : null}
      </Label>
      <Input
        id={`otp-${field}`}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        // Clamped on change rather than on blur, so the field can never hold a
        // value the mutation would reject.
        onChange={(e) => {
          const parsed = Number(e.target.value)
          if (Number.isNaN(parsed)) return
          onChange(clampToLimits(field, parsed))
        }}
      />
      <p className="text-xs text-muted-foreground">
        {help}
        {hint ? ` · ${hint}` : ""}
      </p>
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}
