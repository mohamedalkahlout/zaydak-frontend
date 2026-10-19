"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import {
  BlocksIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
  SendIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { sileo } from "sileo"

import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
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
import { Switch } from "@repo/ui/components/switch"

import type { IntegrationType } from "@/shared/api/generated/graphql"
import {
  DELETE_INTEGRATION,
  INTEGRATION_CONFIGS,
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATUS,
  SAVE_INTEGRATION,
  SEND_INTEGRATION_TEST,
  SET_INTEGRATION_ENABLED,
  SYNC_WHATSAPP_WEBHOOKS,
  VERIFY_INTEGRATION,
} from "../api"
import {
  draftFor,
  isDraftComplete,
  offSpecOf,
  OFF_PROVIDER,
  supportsTestSend,
  supportsWebhookSync,
  testBodyKey,
  testDoneKey,
  testNeedsDestination,
  testTitleKey,
  toCredentials,
  notInUseReasonKey,
  unusableReasonKey,
  type CredentialDraft,
  type IntegrationRow,
  type IntegrationStatusRow,
  type ProviderSpec,
} from "../types"
import { getErrorDetail } from "@/shared/auth/graphql-errors"
import { INTEGRATION_ICONS } from "../nav"
import { CredentialField } from "./credential-field"

/**
 * One integration type's settings screen.
 *
 * The shape is deliberately a settings *form*, not a list of provider cards:
 * exactly one provider is in use at a time, so the primary question is "which
 * one, and with what credentials" — a single select followed by that provider's
 * fields answers it in one read. Showing every provider at once would ask the
 * admin to work out which of five boxes is the live one.
 */
export function IntegrationSettings({ type }: { type: IntegrationType }) {
  const t = useTranslations("integrations")

  const providers = useQuery(INTEGRATION_PROVIDERS)
  const configs = useQuery(INTEGRATION_CONFIGS)
  const status = useQuery(INTEGRATION_STATUS)

  const specs = (providers.data?.integrationProviders.data ?? []).filter(
    (s) => s.type === type,
  )
  const rows = (configs.data?.integrationConfigs.data ?? []).filter(
    (r) => r.type === type,
  )
  const live = status.data?.integrationStatus.data?.find((s) => s.type === type)
  const error =
    providers.error?.message ?? configs.error?.message ?? status.error?.message

  const refetchAll = () => Promise.all([configs.refetch(), status.refetch()])

  const loading = providers.loading && specs.length === 0

  const TypeIcon = INTEGRATION_ICONS[type] ?? BlocksIcon

  return (
    <section className="flex w-full flex-col gap-4">
      {/* Icon beside the title, echoing the rail entry the admin just clicked —
          the same pairing the vendor settings pane uses to say where you are. */}
      <header className="flex items-center gap-2">
        <TypeIcon className="size-5 text-muted-foreground" />
        <h1 className="font-heading text-xl font-semibold">
          {t("pageTitle", { name: t(`type.${type}`) })}
        </h1>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : specs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <ActiveBanner status={live} />
          <TransportForm
            // Re-seeds the form from the server after any write. An event
            // handler cannot do it, because the new values arrive with the
            // refetch rather than with the click.
            key={rows.map((r) => `${r.id}:${r.updated_at}`).join("|")}
            type={type}
            specs={specs}
            rows={rows}
            liveProvider={
              // An UNUSABLE row is still the enabled one, and the one to fix:
              // treating it as live opens the form on it and makes the
              // primary Save re-apply it, rather than offering to switch away.
              live?.source === "DATABASE" || live?.source === "UNUSABLE"
                ? (live.provider ?? null)
                : null
            }
            onChanged={refetchAll}
          />
        </>
      )}
    </section>
  )
}

function TransportForm({
  type,
  specs,
  rows,
  liveProvider,
  onChanged,
}: {
  type: IntegrationType
  specs: ProviderSpec[]
  rows: IntegrationRow[]
  /**
   * The provider whose enabled row this type runs on — or would, for a row the
   * server cannot use — or null when `.env` still serves.
   */
  liveProvider: string | null
  onChanged: () => Promise<unknown>
}) {
  const t = useTranslations("integrations")
  const isArabic = useLocale().startsWith("ar")

  // The off provider is driven by its own switch, never by the provider picker:
  // two controls for one decision is how a screen ends up disagreeing with
  // itself. It is filtered out of the list and handled separately below.
  const offSpec = offSpecOf(specs)
  const selectable = specs.filter((s) => s.provider !== OFF_PROVIDER)
  const isOff = liveProvider === OFF_PROVIDER
  const offRow = rows.find((r) => r.provider === OFF_PROVIDER)
  /**
   * The row holding real credentials — what turning back on restores. Only a
   * provider this build still ships counts: a row left behind by a removed
   * provider (Instagram's `meta_instagram`, replaced by `zernio`) would
   * otherwise open the picker on a value it does not list, beside the form of
   * a different provider.
   */
  const credentialedRow = rows.find(
    (r) =>
      r.provider !== OFF_PROVIDER &&
      specs.some((s) => s.provider === r.provider),
  )

  // Open on the live provider, else one that has credentials saved, else the
  // first in the catalog — so the screen lands on whatever the admin most
  // likely came to look at. While switched off, "live" is the off provider,
  // which is not a choice in this list: fall through to the saved one so the
  // credentials stay visible and editable with generation stopped.
  const initialProvider =
    (isOff ? undefined : liveProvider) ??
    credentialedRow?.provider ??
    selectable[0]?.provider ??
    specs[0]!.provider

  const [provider, setProvider] = useState(initialProvider)
  const spec =
    specs.find((s) => s.provider === provider) ?? selectable[0] ?? specs[0]!
  const row = rows.find((r) => r.provider === spec.provider)

  const [draft, setDraft] = useState<CredentialDraft>(() =>
    draftFor(spec, row),
  )
  /** Which secrets the admin actually typed into. See `toCredentials`. */
  const [touched, setTouched] = useState<Set<string>>(() => new Set())

  const [testOpen, setTestOpen] = useState(false)
  const [destination, setDestination] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [save, { loading: saving }] = useMutation(SAVE_INTEGRATION)
  const [verify, { loading: verifying }] = useMutation(VERIFY_INTEGRATION)
  const [sendTest, { loading: testing }] = useMutation(SEND_INTEGRATION_TEST)
  const [remove, { loading: removing }] = useMutation(DELETE_INTEGRATION)

  const [setEnabled, { loading: switching }] = useMutation(
    SET_INTEGRATION_ENABLED,
  )
  const [syncWebhooks, { loading: syncing }] = useMutation(
    SYNC_WHATSAPP_WEBHOOKS,
  )

  const busy =
    saving || verifying || testing || removing || switching || syncing
  const isLive = !isOff && liveProvider === spec.provider
  const complete = isDraftComplete(spec, draft)
  const needsDestination = testNeedsDestination(type)
  const canTest = supportsTestSend(type)
  const canSyncWebhooks = supportsWebhookSync(type)

  /**
   * Stop or resume the whole integration.
   *
   * Off is a *save*, not a disable: enabling the credential-free `off` provider
   * is what stops the server falling back to the values still in `.env`.
   *
   * On is the reverse in two shapes. With credentials saved here, re-enable
   * that row — which re-verifies them against the provider first, so resuming
   * on a revoked token fails loudly instead of at the next vendor's request.
   * With nothing saved, disable the off row instead and let the environment
   * serve again, which is the state the platform was in before anyone touched
   * this screen.
   */
  const onToggle = async (next: boolean) => {
    try {
      if (!next) {
        await save({
          variables: {
            input: {
              type,
              provider: OFF_PROVIDER,
              credentials: {},
              enable: true,
            },
          },
        })
      } else if (credentialedRow) {
        await setEnabled({
          variables: { input: { id: credentialedRow.id, is_enabled: true } },
        })
      } else if (offRow) {
        await setEnabled({
          variables: { input: { id: offRow.id, is_enabled: false } },
        })
      }
      await onChanged()
      sileo.success({ title: next ? t("power.turnedOn") : t("power.turnedOff") })
    } catch (err) {
      // Turning on re-verifies, so this is where a revoked token surfaces —
      // the provider's own words ride in `detail` and `fail` shows both.
      fail(err, next ? t("power.turnOnFailed") : t("power.turnOffFailed"))
    }
  }

  const switchProvider = (next: string) => {
    const nextSpec = specs.find((s) => s.provider === next)
    if (!nextSpec) return
    setProvider(next)
    setDraft(draftFor(nextSpec, rows.find((r) => r.provider === next)))
    setTouched(new Set())
  }

  const editField = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setTouched((prev) => {
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  // `message` is the translated error code and never more than that, so the
  // provider's own words ride in `extensions.detail`. Both are shown: the code
  // says what the server concluded, the detail says why, and only the second
  // separates a bad key from a port this host blocks.
  const fail = (err: unknown, title: string) =>
    sileo.error({
      title,
      description:
        [err instanceof Error ? err.message : null, getErrorDetail(err)]
          .filter(Boolean)
          .join(" — ") || undefined,
    })

  const onSave = async (enable: boolean) => {
    try {
      await save({
        variables: {
          input: {
            type,
            provider: spec.provider,
            credentials: toCredentials(spec, draft, touched),
            enable,
          },
        },
      })
      await onChanged()
      sileo.success({ title: enable ? t("enabled") : t("saved") })
    } catch (err) {
      // The likely failure is INTEGRATION_VERIFICATION_FAILED, whose message
      // carries the provider's own words. Surfacing it verbatim is the point —
      // "HTTP 401" and "getaddrinfo ENOTFOUND" are different fixes.
      fail(err, t("saveFailed"))
    }
  }

  const onVerify = async () => {
    if (!row) return
    try {
      const { data } = await verify({ variables: { id: row.id } })
      await onChanged()
      const result = data?.verifyIntegration.data
      if (result?.ok) sileo.success({ title: t("verifyOk") })
      else
        sileo.error({
          title: t("verifyFailed"),
          description: result?.error ?? undefined,
        })
    } catch (err) {
      fail(err, t("verifyFailed"))
    }
  }

  /**
   * Register the saved callback origin on every shop's instance.
   *
   * Separate from Save because it is a different blast radius: Save writes one
   * row, this reaches out to every live session on the shared server. It is
   * also the only way to reach numbers paired before the origin was set —
   * registration otherwise happens once, at pairing.
   */
  const onSyncWebhooks = async () => {
    try {
      const { data } = await syncWebhooks()
      const result = data?.syncWhatsAppWebhooks.data
      const updated = result?.updated ?? 0
      const failed = result?.failed ?? 0
      // Partial success is the expected outcome on a shared server, so it is
      // reported as its own state rather than dressed up as success.
      if (failed > 0)
        sileo.error({
          title: t("whatsapp.syncPartial", { updated, failed }),
        })
      else sileo.success({ title: t("whatsapp.syncOk", { updated }) })
    } catch (err) {
      fail(err, t("whatsapp.syncFailed"))
    }
  }

  const onSendTest = async () => {
    if (!row) return
    try {
      await sendTest({
        variables: {
          // Monitoring addresses the project its DSN already names, so there is
          // nothing to send *to* — omitted rather than sent blank, because the
          // back-end decides per type whether one is required.
          input: needsDestination ? { id: row.id, destination } : { id: row.id },
        },
      })
      setTestOpen(false)
      sileo.success({
        title: needsDestination
          ? t("testSent", { destination })
          : t(testDoneKey(type)),
      })
    } catch (err) {
      fail(err, t("testFailed"))
    }
  }

  const onDelete = async () => {
    if (!row) return
    try {
      await remove({ variables: { id: row.id } })
      setConfirmDelete(false)
      await onChanged()
      sileo.success({ title: t("deleted") })
    } catch (err) {
      fail(err, t("deleteFailed"))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/*
        SHIPPING is the one type on this screen that does NOT serve the
        platform's traffic. Every merchant connects their own carrier account,
        and the shipping runtime cannot read this row even by mistake —
        `ShippingProviderService` takes no `IntegrationsService`, so there is no
        handle with which a fallback could be written.

        Stated at the top, in full, because a credential form that quietly does
        nothing is worse than no form: an operator would save a token here and
        reasonably believe shipments were running on it. There is deliberately
        no control that turns this row into a fallback.
      */}
      {type === "SHIPPING" && (
        <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-foreground/10">
          <p className="font-medium">{t("shipping.internalTitle")}</p>
          <p className="mt-1 text-muted-foreground">
            {t("shipping.internalBody")}
          </p>
        </div>
      )}

      {/* Only for types the server ships an `off` provider for. Rendered first
          because it overrides everything below it: with generation stopped, the
          credentials in the form are stored but idle. */}
      {offSpec ? (
        <SettingsCard title={t("power.title")}>
          <div className="flex items-start justify-between gap-6">
            <div className="grid gap-1">
              <Label htmlFor="int-power" className="text-sm font-medium">
                {isOff ? t("power.stateOff") : t("power.stateOn")}
              </Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {isOff ? t("power.helpOff") : t("power.helpOn")}
              </p>
            </div>
            <Switch
              id="int-power"
              checked={!isOff}
              onCheckedChange={(next) => void onToggle(next)}
              disabled={busy}
              aria-label={t("power.title")}
            />
          </div>
        </SettingsCard>
      ) : null}

      <SettingsCard
        title={t("transport.title")}
        description={t("transport.description")}
      >
        <div className="grid gap-1.5 sm:max-w-md">
          <Label htmlFor="int-provider" className="text-sm font-normal">
            {t("transport.provider")}
          </Label>
          <Select
            value={provider}
            onValueChange={(next) => next && switchProvider(String(next))}
            disabled={busy}
          >
            <SelectTrigger id="int-provider" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectable.map((option) => (
                <SelectItem key={option.provider} value={option.provider}>
                  {isArabic ? option.name_ar : option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isArabic ? spec.description_ar : spec.description}
          </p>
        </div>
      </SettingsCard>

      {spec.fields.length > 0 ? (
        <SettingsCard
          title={t("credentialsTitle", {
            name: isArabic ? spec.name_ar : spec.name,
          })}
        >
          <VerificationLine row={row} />
          {/* One column, at the same measure as the provider picker above it.
              Every field here carries a paragraph of server-written help, and
              two columns of unequal prose leave a hole under the shorter one —
              the eye then reads the next label as belonging to the paragraph
              beside it. Stacked, the labels and inputs keep one rhythm. */}
          <div className="grid gap-5 sm:max-w-md">
            {spec.fields.map((field) => (
              <CredentialField
                key={field.key}
                field={field}
                value={draft[field.key] ?? ""}
                // Only when the input actually holds the mask. An unsaved
                // provider's secret box is empty, and "leave the masked value
                // untouched" under an empty box claims a credential exists.
                showsStoredMask={
                  field.secret &&
                  !touched.has(field.key) &&
                  (draft[field.key] ?? "") !== ""
                }
                onChange={(next) => editField(field.key, next)}
                disabled={busy}
              />
            ))}
          </div>
        </SettingsCard>
      ) : (
        <SettingsCard
          title={t("credentialsTitle", {
            name: isArabic ? spec.name_ar : spec.name,
          })}
        >
          <p className="text-sm text-muted-foreground">
            {t("noCredentialsNeeded")}
          </p>
        </SettingsCard>
      )}

      <footer className="flex flex-wrap items-center gap-2">
        {/* While switched off, saving must NOT switch: editing a token is not
            a request to resume generating, and the switch above is the only
            control that starts it again. */}
        <Button
          onClick={() => void onSave(!isOff)}
          disabled={busy || !complete}
        >
          {saving ? t("saving") : t("save")}
        </Button>

        {/* Only when it would actually differ: saving a provider that is
            already live cannot avoid switching to it, and while off the
            primary button already saves without switching. */}
        {!isLive && !isOff ? (
          <Button
            variant="outline"
            onClick={() => void onSave(false)}
            disabled={busy || !complete}
          >
            {t("saveWithoutSwitching")}
          </Button>
        ) : null}

        {row ? (
          <>
            <Button variant="ghost" onClick={() => void onVerify()} disabled={busy}>
              {verifying ? t("verifying") : t("verify")}
            </Button>
            {/* A dev sink delivers nothing, so testing it proves nothing; AI
                media has no free test at all — its cheapest call is a billable
                prediction, and Verify already reaches the account. */}
            {!spec.is_dev_sink && canTest ? (
              <Button
                variant="ghost"
                onClick={() => setTestOpen(true)}
                disabled={busy}
              >
                <SendIcon className="size-4" />
                {t("sendTest")}
              </Button>
            ) : null}
            {/* WhatsApp only. Registration happens per shop instance at
                pairing, so changing the origin reaches nobody already
                connected until this runs. */}
            {canSyncWebhooks ? (
              <Button
                variant="ghost"
                onClick={() => void onSyncWebhooks()}
                disabled={busy}
                title={t("whatsapp.syncHelp")}
              >
                <RefreshCwIcon className="size-4" />
                {syncing ? t("whatsapp.syncing") : t("whatsapp.sync")}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="ms-auto text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              {t("delete")}
            </Button>
          </>
        ) : null}
      </footer>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(testTitleKey(type))}</DialogTitle>
            <DialogDescription>
              {t(`test.${testBodyKey(type)}`)}
            </DialogDescription>
          </DialogHeader>
          {/* No field at all for a type with nowhere to send: an empty input
              labelled "destination" would ask the admin to invent one. */}
          {needsDestination ? (
            <div className="grid gap-1.5">
              <Label htmlFor="int-test-destination">
                {type === "SMS" ? t("test.phone") : t("test.email")}
              </Label>
              <Input
                id="int-test-destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={
                  type === "SMS" ? "+15551234567" : "you@example.com"
                }
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => void onSendTest()}
              disabled={
                testing || (needsDestination && destination.trim().length < 3)
              }
            >
              {testing ? t("sending") : t("send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmDelete.title")}</DialogTitle>
            {/* Naming the consequence matters: deleting the live provider is
                otherwise silent — sending keeps working, from the .env account. */}
            <DialogDescription>
              {t(isLive ? "confirmDelete.bodyLive" : "confirmDelete.body", {
                provider: isArabic ? spec.name_ar : spec.name,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void onDelete()}
              disabled={removing}
            >
              {removing ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * The card shell every section uses: a titled header over a bordered body.
 *
 * `ring-1 ring-foreground/10` rather than `border`, matching the vendor
 * dashboard's settings cards — a ring does not occupy layout space, so the card
 * keeps its outline against the rail's card without the two hairlines
 * disagreeing by a pixel at different zoom levels.
 */
function SettingsCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="border-b px-5 py-4">
        <h2 className="font-medium">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

/** What this type is sending through right now, and where it came from. */
function ActiveBanner({ status }: { status: IntegrationStatusRow | undefined }) {
  const t = useTranslations("integrations")
  if (!status) return null

  const unconfigured = status.source === "NONE"
  const off = status.provider === OFF_PROVIDER

  // Resolves, and the server does not run on it: Storage while the server's
  // STORAGE_DRIVER is not bunnycdn. It read as configured while every upload
  // went to local disk. Checked first, because nothing below is true of a
  // configuration no upload reads — a dead row here refuses nothing either.
  if (status.not_in_use_reason) {
    return (
      <div
        role="status"
        className="grid gap-1 rounded-xl bg-muted/40 px-4 py-3 text-sm ring-1 ring-foreground/10"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <TriangleAlertIcon className="size-4 shrink-0 text-amber-600" />
          {t("notInUse.title")}
        </span>
        <p className="text-muted-foreground">
          {t(notInUseReasonKey(status.not_in_use_reason))}
        </p>
        {status.unusable_reason ? (
          <p className="text-muted-foreground">
            {t(unusableReasonKey(status.unusable_reason))}
          </p>
        ) : null}
      </div>
    )
  }

  // Saved, enabled, and unreadable — with nothing serving in its place. It
  // used to render as "nothing configured", which sends an admin looking for a
  // form they never filled in rather than at the row that broke. Checked
  // before the off switch: an `off` row that will not decrypt is not a choice.
  if (status.source === "UNUSABLE") {
    return (
      <div
        role="alert"
        className="grid gap-1 rounded-xl bg-destructive/5 px-4 py-3 text-sm ring-1 ring-destructive/30"
      >
        <span className="flex items-center gap-1.5 font-medium text-destructive">
          <TriangleAlertIcon className="size-4 shrink-0" />
          {t("unusable.title", { provider: status.provider ?? "" })}
        </span>
        <p className="text-muted-foreground">
          {t(unusableReasonKey(status.unusable_reason))}{" "}
          {status.type === "STORAGE"
            ? t("unusable.consequenceStorage")
            : t("unusable.consequence")}
        </p>
      </div>
    )
  }

  // Switched off is a deliberate state, not a misconfiguration, so it reads as
  // its own line rather than borrowing the dev-sink warning — "nothing is being
  // delivered" describes a mistake, and this one an admin chose.
  if (off) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 px-4 py-3 text-sm ring-1 ring-foreground/10">
        <span className="flex items-center gap-1.5 font-medium">
          <TriangleAlertIcon className="size-4 text-destructive" />
          {t("power.bannerOff")}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 px-4 py-3 text-sm ring-1 ring-foreground/10">
      <span className="text-muted-foreground">{t("activeNow")}</span>
      <Badge variant={status.source === "DATABASE" ? "default" : "outline"}>
        {status.provider ?? t("source.NONE")}
      </Badge>
      <span className="text-muted-foreground">
        {t(`source.${status.source}`)}
      </span>
      {status.is_dev_sink || unconfigured ? (
        <span className="flex items-center gap-1.5 text-destructive">
          <TriangleAlertIcon className="size-4" />
          {t("devSinkWarning")}
        </span>
      ) : null}
      {/* The fall-back half of the same failure: the environment is serving,
          which the line above says truthfully, and this says why the row
          saved here is not. */}
      {status.unusable_reason ? (
        <p className="flex w-full items-start gap-1.5 text-destructive">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            {t("unusable.fallback")}{" "}
            {t(unusableReasonKey(status.unusable_reason))}
          </span>
        </p>
      ) : null}
    </div>
  )
}

/** When the provider last accepted these credentials, or why it did not. */
function VerificationLine({ row }: { row: IntegrationRow | undefined }) {
  const t = useTranslations("integrations")
  const isArabic = useLocale().startsWith("ar")
  if (!row) return null

  if (row.last_verify_error) {
    return (
      <p className="mb-4 flex items-start gap-2 text-sm text-destructive">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
        <span>{row.last_verify_error}</span>
      </p>
    )
  }
  if (!row.last_verified_at) return null

  return (
    <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
      <CheckCircle2Icon className="size-4 shrink-0" />
      {t("verifiedAt", {
        when: new Date(row.last_verified_at).toLocaleString(
          isArabic ? "ar" : "en",
        ),
      })}
    </p>
  )
}
