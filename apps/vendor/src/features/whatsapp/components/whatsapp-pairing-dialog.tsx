"use client"

import { useCallback, useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import Image from "@/shared/components/app-image"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
} from "lucide-react"

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@repo/ui/components/drawer"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { cn } from "@/shared/lib/utils"
import { sileo } from "sileo"
import { REQUEST_WHATSAPP_PAIRING_CODE } from "../api"
import type {
  PairingCodeResult,
  WhatsAppHandshake,
  WhatsAppStreamEvent,
} from "../types"
import { useWhatsAppQrStream } from "../use-whatsapp-qr-stream"
import { StatusDot } from "./whatsapp-status-pill"

/**
 * The WhatsApp pairing surface — Shopify-style bottom drawer popup matching
 * `TargetCreateDialog` and `NewCustomerDialog`.
 *
 * A bottom drawer (slides up, with a swipe handle) holding a two-column layout:
 * - Start side: step-by-step guidance, connection method tab switch (QR vs 8-digit phone code),
 *   phone number input form, device limit alerts and multi-device consent note.
 * - End side: live interactive code surface (QR code with countdown life bar, or 8-digit
 *   pairing code with quick-copy), live connection listening indicator and stream status.
 *
 * Success state renders smoothly in the same surface with connected phone confirmation.
 */
export function WhatsAppPairingDialog({
  open,
  initial,
  connectedNumber,
  onConnected,
  onClose,
}: {
  open: boolean
  /** The code the connect mutation already returned — shown with no delay. */
  initial: WhatsAppHandshake | null
  /** Filled in by the parent's refetch, so the success screen names the phone. */
  connectedNumber: string | null
  /** Fired once, the moment the session connects: the parent re-reads status. */
  onConnected: () => void
  onClose: () => void
}) {
  const t = useTranslations("settings.whatsapp")

  const [qr, setQr] = useState<string | null>(initial?.qr_code ?? null)
  const [pairingCode, setPairingCode] = useState<string | null>(
    initial?.pairing_code ?? null,
  )
  const [streamError, setStreamError] = useState(false)
  const [connected, setConnected] = useState(false)
  const [askingForCode, setAskingForCode] = useState(false)
  const [phone, setPhone] = useState("")

  /**
   * Re-seed from a *new* handshake without an effect.
   *
   * React's adjust-state-during-render pattern rather than
   * `useEffect(() => setQr(initial.qr_code), [initial])`: the effect version
   * commits one frame showing the previous attempt's code, and on this screen
   * that frame is a QR nobody can scan. Comparing against the handshake we
   * last seeded from makes React discard the render and re-run it instead.
   */
  const [seededFrom, setSeededFrom] = useState(initial)
  if (initial !== seededFrom) {
    setSeededFrom(initial)
    setQr(initial?.qr_code ?? null)
    setPairingCode(initial?.pairing_code ?? null)
    setConnected(false)
    setStreamError(false)
    setAskingForCode(false)
  }

  const [requestCode, { loading: requestingCode, error: codeError }] =
    useMutation<PairingCodeResult>(REQUEST_WHATSAPP_PAIRING_CODE)

  const onEvent = useCallback(
    (event: WhatsAppStreamEvent) => {
      switch (event.type) {
        case "qr":
          setQr(event.qr)
          setStreamError(false)
          break
        case "connected":
          setConnected(true)
          onConnected()
          break
        case "error":
          setStreamError(true)
          break
        default:
          break
      }
    },
    [onConnected],
  )

  // The stream runs only while this dialog is open and unconnected.
  useWhatsAppQrStream({ enabled: open && !connected, onEvent })

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      swipeDirection="down"
      showSwipeHandle
    >
      <DrawerContent className="mx-auto max-w-4xl max-h-[calc(100dvh-1.5rem)]">
        <div className="mx-auto flex min-h-0 w-full flex-1 flex-col">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-border/50">
            <div className="flex items-center gap-3 min-w-0">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 ring-1 ring-emerald-500/20"
              >
                {connected ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <Smartphone className="size-5" />
                )}
              </span>
              <div className="min-w-0">
                <DrawerTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
                  {connected ? t("success.title") : t("pairing.title")}
                </DrawerTitle>
                <DrawerDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                  {connected ? t("success.body") : t("pairing.subtitle")}
                </DrawerDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="shrink-0"
            >
              {connected ? t("success.continue") : t("pairing.cancel")}
            </Button>
          </div>

          {/* Content Body */}
          {connected ? (
            <div className="flex-1 overflow-y-auto p-5">
              <PairingSuccess number={connectedNumber} onDone={onClose} />
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 sm:p-5 lg:grid-cols-12">
              {/* Left Column: Guidance & Method switch */}
              <div className="flex flex-col justify-between gap-5 rounded-2xl bg-card p-4 sm:p-5 ring-1 ring-foreground/10 lg:col-span-7">
                <div className="space-y-4">
                  {/* Mode switch tabs */}
                  <div className="flex rounded-xl bg-muted/60 p-1 text-xs font-medium ring-1 ring-foreground/5">
                    <button
                      type="button"
                      onClick={() => {
                        setAskingForCode(false)
                        setPairingCode(null)
                      }}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 transition-all cursor-pointer",
                        !askingForCode && !pairingCode
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <QrCode className="size-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{t("pairing.tabQr")}</span>
                      <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                        {t("pairing.recommended")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAskingForCode(true)
                      }}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 transition-all cursor-pointer",
                        askingForCode || pairingCode
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Smartphone className="size-4" />
                      <span>{t("pairing.tabPhone")}</span>
                    </button>
                  </div>

                  {/* QR Mode Steps */}
                  {!askingForCode && !pairingCode ? (
                    <div className="space-y-4">
                      <Steps />

                      {/* Device limit notice */}
                      <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed">
                        <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <span>{t("pairing.deviceLimit")}</span>
                      </div>
                    </div>
                  ) : (
                    /* Phone code pairing mode */
                    <div className="space-y-4">
                      {askingForCode ? (
                        <form
                          className="space-y-4"
                          onSubmit={async (e) => {
                            e.preventDefault()
                            const res = await requestCode({
                              variables: { input: { phone } },
                            })
                            const shake = res.data?.requestWhatsAppPairingCode.data
                            if (shake?.pairing_code) {
                              setPairingCode(shake.pairing_code)
                              setQr(null)
                              setAskingForCode(false)
                            }
                          }}
                        >
                          <div className="space-y-2">
                            <Label htmlFor="wa-phone" className="text-sm font-medium">
                              {t("pairing.phoneLabel")}
                            </Label>
                            <Input
                              id="wa-phone"
                              dir="ltr"
                              placeholder="+9665xxxxxxxx"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="font-mono text-base h-11"
                              required
                              autoFocus
                            />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {t("pairing.phoneHelp")}
                            </p>
                          </div>

                          {codeError && (
                            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive ring-1 ring-destructive/20">
                              <AlertTriangle className="size-4 shrink-0" />
                              <span>{t("pairing.codeFailed")}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2.5 pt-1">
                            <Button
                              type="submit"
                              disabled={requestingCode || !phone.trim()}
                            >
                              {requestingCode ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Smartphone className="size-4" />
                              )}
                              {t("pairing.getCode")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setAskingForCode(false)
                              }}
                            >
                              {t("pairing.backToQr")}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="space-y-3">
                          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2 text-xs leading-relaxed">
                            <p className="font-semibold text-foreground">
                              {t("pairing.codeHelp")}
                            </p>
                            <ol className="space-y-1.5 text-muted-foreground list-decimal list-inside">
                              <li>{t("pairing.step1")}</li>
                              <li>{t("pairing.step2")}</li>
                              <li>{t("pairing.codeHelp")}</li>
                            </ol>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setAskingForCode(true)}
                            >
                              <Smartphone className="size-3.5" />
                              {t("pairing.phoneLabel")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPairingCode(null)
                                setAskingForCode(false)
                              }}
                            >
                              {t("pairing.backToQr")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer security note */}
                <div className="flex items-center gap-2 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{t("pairing.secureSession")}</span>
                </div>
              </div>

              {/* Right Column: Code Showcase Surface */}
              <div className="flex flex-col gap-3 lg:col-span-5">
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {pairingCode ? t("pairing.tabPhone") : t("pairing.tabQr")}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <StatusDot tone="pending" />
                    <span className="text-muted-foreground font-medium">
                      {t("pairing.listening")}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 min-h-[380px] flex-col items-center justify-center rounded-2xl bg-muted/30 p-5 ring-1 ring-foreground/10 text-center relative overflow-hidden">
                  <CodeSurface
                    qr={qr}
                    pairingCode={pairingCode}
                    qrAlt={t("pairing.qrAlt")}
                    waiting={t("pairing.waiting")}
                    codeHelp={t("pairing.codeHelp")}
                    refreshes={t("pairing.refreshes")}
                    copyLabel={t("pairing.copyCode")}
                    copiedLabel={t("pairing.codeCopied")}
                  />

                  {streamError && (
                    <div className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive ring-1 ring-destructive/20 text-start w-full max-w-xs">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      <span>{t("pairing.streamError")}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/**
 * The three steps with rich numbered styling.
 */
function Steps() {
  const t = useTranslations("settings.whatsapp.pairing")
  const steps = [t("step1"), t("step2"), t("step3")]
  return (
    <div className="space-y-2.5">
      {steps.map((text, i) => (
        <div
          key={text}
          className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5 transition-colors hover:bg-muted/40"
        >
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold ring-1 ring-emerald-500/20 tabular-nums"
          >
            {i + 1}
          </span>
          <p className="text-sm font-medium leading-relaxed text-foreground">
            {text}
          </p>
        </div>
      ))}
    </div>
  )
}

/**
 * Whichever credential this attempt produced (QR code or 8-digit Pairing Code).
 */
function CodeSurface({
  qr,
  pairingCode,
  qrAlt,
  waiting,
  codeHelp,
  refreshes,
  copyLabel,
  copiedLabel,
}: {
  qr: string | null
  pairingCode: string | null
  qrAlt: string
  waiting: string
  codeHelp: string
  refreshes: string
  copyLabel: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!pairingCode) return
    navigator.clipboard.writeText(pairingCode)
    setCopied(true)
    sileo.success({ title: copiedLabel })
    setTimeout(() => setCopied(false), 2000)
  }

  if (pairingCode) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center max-w-xs w-full py-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 ring-1 ring-emerald-500/20">
          <Smartphone className="size-7" />
        </div>
        <div className="space-y-2 w-full">
          <p className="text-xs font-medium text-muted-foreground">
            {codeHelp}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span
              dir="ltr"
              className="font-mono text-3xl sm:text-4xl font-extrabold tracking-[0.22em] text-foreground bg-card px-4 py-2.5 rounded-xl border border-border/70 select-all shadow-xs"
            >
              {pairingCode}
            </span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-11 shrink-0 rounded-xl"
              onClick={handleCopy}
              title={copyLabel}
            >
              {copied ? (
                <Check className="size-4 text-emerald-600" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!qr) {
    return (
      <div className="flex h-[288px] flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
          <Loader2 className="size-7 animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{waiting}</p>
          <p className="text-xs text-muted-foreground">
            {refreshes}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="relative rounded-2xl bg-white p-3.5 shadow-md ring-1 ring-black/10 transition-transform duration-200 hover:scale-[1.02]">
        <Image
          src={qr}
          alt={qrAlt}
          width={240}
          height={240}
          unoptimized
          className="size-[240px] rounded-lg block"
        />
      </div>
      <div className="w-full max-w-[240px] space-y-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            key={qr}
            className="h-full w-full origin-left rounded-full bg-emerald-500 rtl:origin-right"
            style={{ animation: "pairing-code-life 20s linear infinite" }}
          />
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ScanLine className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{refreshes}</span>
        </p>
      </div>
    </div>
  )
}

/**
 * The end of the flow, in the surface it started in.
 */
function PairingSuccess({
  number,
  onDone,
}: {
  number: string | null
  onDone: () => void
}) {
  const t = useTranslations("settings.whatsapp.success")
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center max-w-md mx-auto my-auto animate-in fade-in-50 zoom-in-95 duration-300">
      <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 ring-8 ring-emerald-500/10">
        <CheckCircle2 className="size-10" />
      </div>
      <h3 className="font-heading text-2xl font-bold tracking-tight text-foreground">
        {t("title")}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {t("body")}
      </p>

      {number && (
        <div
          dir="ltr"
          className="mt-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-2.5 font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400 shadow-xs"
        >
          <Smartphone className="size-4 shrink-0" />
          <span>{number}</span>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border/60 bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground max-w-sm">
        {t("next")}
      </div>

      <Button className="mt-6 w-full max-w-xs" size="lg" onClick={onDone}>
        {t("continue")}
      </Button>
    </div>
  )
}
