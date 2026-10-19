"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useQuery, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  ArrowLeftIcon,
  SendIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  CheckIcon,
} from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Switch } from "@repo/ui/components/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import {
  NOTIFICATION_TEMPLATE,
  UPDATE_NOTIFICATION_TEMPLATE,
  REVERT_NOTIFICATION_TEMPLATE,
  PREVIEW_NOTIFICATION_TEMPLATE,
  SEND_TEST_NOTIFICATION,
} from "../api"
import type {
  NotificationTemplateResult,
  UpdateTemplateResult,
  RevertTemplateResult,
  PreviewTemplateResult,
  NotificationTemplateEntry,
} from "../types"

interface Draft {
  subject: string
  body: string
  enabled: boolean
}

/**
 * The Shopify per-template editor: subject + Liquid HTML body (staged locally
 * and saved through the global contextual save bar — never on keystroke), a
 * live Preview rendered by the back-end in a sandboxed iframe, Send test, and
 * Revert to previous / default.
 */
export function TemplateEditor({
  eventKey,
  onBack,
  onChanged,
}: {
  eventKey: string
  onBack: () => void
  onChanged: () => void
}) {
  const t = useTranslations("notifications")

  const { data, refetch } = useQuery<NotificationTemplateResult>(
    NOTIFICATION_TEMPLATE,
    { variables: { event_key: eventKey }, fetchPolicy: "cache-and-network" },
  )
  const server = data?.notificationTemplate.data ?? null

  const [draft, setDraft] = useState<Draft | null>(null)
  const seededKey = useRef<string | null>(null)

  const [update] = useMutation<UpdateTemplateResult>(
    UPDATE_NOTIFICATION_TEMPLATE,
  )
  const [revert] = useMutation<RevertTemplateResult>(
    REVERT_NOTIFICATION_TEMPLATE,
  )
  const [preview, { data: previewData, loading: previewing }] =
    useMutation<PreviewTemplateResult>(PREVIEW_NOTIFICATION_TEMPLATE)
  const [sendTest, { loading: sending }] = useMutation(SEND_TEST_NOTIFICATION)
  const [testSent, setTestSent] = useState(false)

  const show = useUnsavedBarStore((s) => s.show)
  const hide = useUnsavedBarStore((s) => s.hide)
  const setError = useUnsavedBarStore((s) => s.setError)

  const runPreview = useCallback(
    (d: Draft) => {
      void preview({
        variables: {
          input: { event_key: eventKey, subject: d.subject, body: d.body },
        },
      })
    },
    [preview, eventKey],
  )

  // Seed the draft once per template; re-seed only when the event_key changes.
  useEffect(() => {
    if (server && seededKey.current !== eventKey) {
      const seeded = {
        subject: server.subject,
        body: server.body,
        enabled: server.enabled,
      }
      setDraft(seeded)
      seededKey.current = eventKey
      runPreview(seeded)
    }
  }, [server, eventKey, runPreview])

  const dirty =
    !!draft &&
    !!server &&
    (draft.subject !== server.subject ||
      draft.body !== server.body ||
      draft.enabled !== server.enabled)

  // Drive the global contextual save bar while dirty.
  useEffect(() => {
    if (!dirty || !draft) {
      hide()
      return
    }
    const onSave = async () => {
      useUnsavedBarStore.getState().update({ saving: true })
      try {
        const res = await update({
          variables: {
            input: {
              event_key: eventKey,
              subject: draft.subject,
              body: draft.body,
              enabled: draft.enabled,
            },
          },
        })
        const next = res.data?.updateNotificationTemplate.data
        if (next) {
          setDraft({
            subject: next.subject,
            body: next.body,
            enabled: next.enabled,
          })
        }
        onChanged()
        hide()
      } catch (e) {
        setError(e instanceof Error ? e.message : t("console.saveError"))
      }
    }
    const onDiscard = () => {
      if (server) {
        setDraft({
          subject: server.subject,
          body: server.body,
          enabled: server.enabled,
        })
      }
      hide()
    }
    show({ label: t("console.unsaved"), saving: false, onSave, onDiscard })
  }, [
    dirty,
    draft,
    server,
    eventKey,
    update,
    onChanged,
    show,
    hide,
    setError,
    t,
  ])

  useEffect(() => () => hide(), [hide])

  async function onRevert(to: "PREVIOUS" | "DEFAULT") {
    const res = await revert({ variables: { input: { event_key: eventKey, to } } })
    const next = res.data?.revertNotificationTemplate.data
    if (next) applyServer(next)
    await refetch()
    onChanged()
  }

  function applyServer(next: NotificationTemplateEntry) {
    const seeded = {
      subject: next.subject,
      body: next.body,
      enabled: next.enabled,
    }
    setDraft(seeded)
    runPreview(seeded)
  }

  async function onSendTest() {
    await sendTest({ variables: { event_key: eventKey } })
    setTestSent(true)
    setTimeout(() => setTestSent(false), 3000)
  }

  if (!draft || !server) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <RefreshCwIcon className="size-4 animate-spin" />
        {t("console.loading")}
      </div>
    )
  }

  const previewHtml = previewData?.previewNotificationTemplate.html ?? ""

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          {t("console.backToList")}
        </button>
        <h2 className="text-base font-semibold">
          {t(`console.events.${eventKey}`)}
        </h2>

        <div className="ms-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("console.enabled")}</span>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={onSendTest}
            disabled={sending}
          >
            {testSent ? (
              <CheckIcon className="size-4" />
            ) : (
              <SendIcon className="size-4" />
            )}
            {testSent ? t("console.testSent") : t("console.sendTest")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(p) => (
                <Button {...p} variant="outline" size="sm">
                  <RotateCcwIcon className="size-4" />
                  {t("console.revert")}
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!server.has_previous}
                onClick={() => void onRevert("PREVIOUS")}
              >
                {t("console.revertPrevious")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!server.is_customized}
                onClick={() => void onRevert("DEFAULT")}
              >
                {t("console.revertDefault")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Editor + preview */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("console.subject")}
            </span>
            <Input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("console.body")}
            </span>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              spellCheck={false}
              className="min-h-100 flex-1 resize-y rounded-lg border border-border bg-card p-3 font-mono text-[13px] leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {t("console.liquidHint")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("console.preview")}
            </span>
            <button
              type="button"
              onClick={() => runPreview(draft)}
              disabled={previewing}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
            >
              <RefreshCwIcon
                className={previewing ? "size-3.5 animate-spin" : "size-3.5"}
              />
              {t("console.refreshPreview")}
            </button>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-white">
            <iframe
              title={t("console.preview")}
              srcDoc={previewHtml}
              sandbox=""
              className="h-150 w-full"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
