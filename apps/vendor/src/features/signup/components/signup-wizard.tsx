"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { AuthShell } from "@repo/ui/components/auth-shell"
import { Button } from "@repo/ui/components/button"

import { LocaleSwitcher } from "@/shared/components/locale-switcher"

import type { SignupDraftData, SignupStep } from "../types"
import { DEFAULT_SIGNUP_COUNTRY } from "../lib/countries"
import {
  readSignupProgress,
  writeSignupProgress,
  clearSignupProgress,
  shouldRestoreSignupProgress,
} from "../lib/progress"
import {
  SIGNUP_RAIL_STEPS,
  completedProgress,
  railIndexForPane,
} from "../lib/steps"
import { SignupBrand } from "./signup-brand"
import { SignupStepper } from "./signup-stepper"
import { EmailStep } from "./steps/email-step"
import { PersonalStep } from "./steps/personal-step"
import { OtpStep } from "./steps/otp-step"
import { StoreStep } from "./steps/store-step"

interface WizardState {
  pane: SignupStep
  email: string
  personal: { name: string; countryCode: string; phone: string }
  draft: SignupDraftData | null
}

const EMPTY: WizardState = {
  pane: "email",
  email: "",
  personal: { name: "", countryCode: DEFAULT_SIGNUP_COUNTRY.code, phone: "" },
  draft: null,
}

/**
 * The four-pane vendor signup behind `/register`.
 *
 * The first three panes share one card and one rail, so what changes between
 * those steps is only the question being asked. The last pane leaves that
 * frame and stands on `/create-store`'s screen instead — type chips, Continue
 * and Skip. No account exists until that last pane succeeds — everything
 * before it lives in the signed draft the server issued.
 */
export function SignupWizard() {
  const t = useTranslations("signup")
  // The chips are the door's shared vocabulary, not signup copy — same keys
  // the (auth) layout passes, so the two screens can never drift apart.
  const tAuth = useTranslations("auth")
  const [state, setState] = useState<WizardState>(EMPTY)

  // Restored after mount rather than in the initializer: the page is rendered
  // on the server too, and sessionStorage does not exist there. A refresh on
  // `/register` is the only visit that should find anything to restore —
  // Login → Create and a new visit after closing the site start empty.
  useEffect(() => {
    if (!shouldRestoreSignupProgress()) {
      clearSignupProgress()
      return
    }
    const stored = readSignupProgress<WizardState>()
  /* eslint-disable-next-line react-hooks/set-state-in-effect --
   * Restoring persisted state after hydration is the one case an effect is
   * still the answer for. A `useState` initializer cannot do it: this page is
   * server-rendered and web storage does not exist there, so reading it in the
   * initializer produces markup the server could never have sent and React
   * throws out the whole tree on a hydration mismatch. Nor is it a
   * `useSyncExternalStore` — this component OWNS the value and writes it back;
   * storage is where it is parked between visits, not a store it observes.
   */
    if (stored) setState(stored)
  }, [])

  useEffect(() => {
    // Nothing worth restoring until the first pane has been answered.
    if (!state.email) return
    writeSignupProgress(state)
  }, [state])

  const reset = () => {
    clearSignupProgress()
    setState({ ...EMPTY, personal: { ...EMPTY.personal } })
  }

  // The last two panes are meaningless without the draft the server issued, so
  // a truncated or hand-edited storage entry falls back to the start rather
  // than rendering an empty card.
  const pane: SignupStep =
    (state.pane === "otp" || state.pane === "store") && !state.draft
      ? "email"
      : state.pane

  const activeIndex = railIndexForPane(pane)

  // Localized here rather than inside the rail: the rail and the stepper are two
  // shapes of one list, and the code sign-in feeds them a list of its own.
  const steps = useMemo(
    () =>
      SIGNUP_RAIL_STEPS.map((step) => ({
        key: step.key,
        title: t(`steps.${step.key}.title`),
        description: t(`steps.${step.key}.description`),
        progress: step.progress,
      })),
    [t],
  )

  // The last pane is `/create-store`'s screen, not a card inside this shell:
  // type chips on StoreFrame, no name/slug/country fields. It still consumes
  // the same draft; only the picture changes.
  if (pane === "store" && state.draft) {
    return (
      <StoreStep
        draft={state.draft}
        phoneCountryCode={state.personal.countryCode}
        onSessionLost={reset}
        onBack={() => setState((s) => ({ ...s, pane: "otp" }))}
      />
    )
  }

  return (
    // The login frame, verbatim: signing up and signing in are the same door.
    // What is signup-specific arrives through slots — the step row on the
    // ground and a wider card, since these panes ask several questions at once.
    <AuthShell
      wide
      brand={<SignupBrand />}
      eyebrow={t("rail.eyebrow")}
      headline={t("rail.title")}
      quote={t("rail.percentComplete", { percent: completedProgress(pane) })}
      progress={<SignupStepper steps={steps} activeIndex={activeIndex} />}
      backLink={
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          {/* The chevron points back the way the reader came, either direction. */}
          <ChevronLeftIcon className="size-4 rtl:rotate-180" />
          {t("rail.backToLogin")}
        </Button>
      }
      toolbar={<LocaleSwitcher variant="labeled" />}
      chips={[
        tAuth("layout.chipCatalog"),
        tAuth("layout.chipPayments"),
        tAuth("layout.chipReports"),
      ]}
    >
      {pane === "email" ? (
        <EmailStep
          defaultEmail={state.email}
          onNext={(email) => setState((s) => ({ ...s, email, pane: "personal" }))}
        />
      ) : null}

      {pane === "personal" ? (
        <PersonalStep
          email={state.email}
          defaults={state.personal}
          onSent={(draft, values) =>
            setState((s) => ({
              ...s,
              draft,
              personal: {
                name: values.name,
                countryCode: values.country_code,
                phone: values.phone,
              },
              pane: "otp",
            }))
          }
          onEmailRejected={() => setState((s) => ({ ...s, pane: "email" }))}
        />
      ) : null}

      {pane === "otp" && state.draft ? (
        <OtpStep
          draft={state.draft}
          onVerified={(draft) => setState((s) => ({ ...s, draft, pane: "store" }))}
          onDraftRefreshed={(draft) => setState((s) => ({ ...s, draft }))}
          onBack={() => setState((s) => ({ ...s, pane: "personal" }))}
        />
      ) : null}

      <p className="pt-6 text-center text-xs text-zinc-500">{t("terms")}</p>
    </AuthShell>
  )
}
