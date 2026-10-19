"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { Check, Send } from "lucide-react"

import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { Textarea } from "@repo/ui/components/textarea"

import { getErrorCode } from "@/shared/auth/graphql-errors"
import { CONTACT_MESSAGE_RATE_LIMITED, SEND_CONTACT_MESSAGE } from "../api"
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_ORDER_NUMBER_MAX_LENGTH,
  contactFormSchema,
  type ContactFormValues,
} from "../validation"

/**
 * Writing to a shop without an account.
 *
 * ## The one rule everything else is arranged around
 *
 * **There are exactly two outcomes on this screen, and only one of them is a
 * refusal.** `ContactFormService` answers a known address, an unknown address,
 * a tripped honeypot and a body its moderator blocked with byte-for-byte the
 * same acknowledgement, precisely so that nobody can stand in front of this
 * form and learn which addresses the platform has heard of. That property is
 * built on the server and **spent on the client**: a screen that said "we could
 * not send that" for the moderation case, or quietly left the form up for the
 * honeypot one, would hand an enumerator back the difference the back-end went
 * to the trouble of erasing.
 *
 * So every path that is not `CONTACT_MESSAGE_RATE_LIMITED` renders the same
 * confirmation, out of the same branch, replacing the form with the same DOM.
 * A transport failure takes that branch too, which is the uncomfortable half of
 * the rule and still the right call: from here, a dropped connection and a
 * server that chose to drop the message are the same event, and inventing a
 * third state for the one case we cannot distinguish is inventing exactly the
 * signal an oracle needs. The real error is logged in development, where there
 * is nobody to enumerate and a developer otherwise has nothing at all.
 *
 * The rate limit is the documented exception because it is not about the
 * *message* — it is about how many have left this address in the last hour,
 * which the sender already knows and from which enumeration learns nothing.
 * Dressing it as a success would be worse than useless: the visitor would walk
 * away believing a message had been filed that was never written down.
 *
 * ## The honeypot
 *
 * `website` is the field a person can never reach and a form-filling bot always
 * fills. It is off-screen rather than `display: none`, because the cheap
 * scrapers skip inputs hidden that way on the assumption they are decoys, and
 * `aria-hidden` plus `tabIndex={-1}` keep it out of reach of the people the
 * off-screen trick would otherwise strand in it.
 *
 * **The client never inspects it.** A submission with the trap filled is sent
 * anyway, exactly as typed: the back-end spends its per-IP ceiling *before* it
 * looks at the trap, so a bot short-circuited here would be the one caller on
 * the platform with no rate limit at all.
 */
export function ContactForm({ shopName }: { shopName: string }) {
  const t = useTranslations("contact")
  const tCommon = useTranslations("common")
  const tValidation = useTranslations("validation")

  /**
   * "The server acknowledged", not "the message was delivered" — and that
   * distinction is the feature. Four different fates on the back-end arrive
   * here as one boolean, which is the only shape this screen may hold.
   */
  const [acknowledged, setAcknowledged] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)

  const [send, { loading }] = useMutation(SEND_CONTACT_MESSAGE)

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      order_number: "",
      message: "",
      website: "",
    },
  })

  // Subscribed rather than tracked with an `onChange` of our own: the counter
  // and the field then cannot disagree about what is in the box, which is the
  // whole job of a counter sitting under a cap the server also enforces.
  //
  // `useWatch` rather than `watch()` — `watch` is a function returned from
  // `useForm`, and the React Compiler skips compiling any component that calls
  // one (`react-hooks/incompatible-library`): it cannot memoize a function
  // whose result changes without a dependency it can see. `useWatch` is a hook
  // subscribed to one field, which it can.
  const typed = useWatch({ control, name: "message" }) ?? ""
  const remaining = CONTACT_MESSAGE_MAX_LENGTH - typed.length

  async function onSubmit(values: ContactFormValues) {
    setRateLimited(false)

    try {
      await send({
        variables: {
          input: {
            name: values.name,
            email: values.email,
            message: values.message,
            // Empty is absent. The DTO takes `order_number` as optional and
            // records it as text without ever looking it up — resolving it
            // would let the form answer "that is not one of ours", which is the
            // enumeration oracle again in a second currency.
            order_number: values.order_number?.trim() || undefined,
            // Carried exactly as it arrived, empty included. See the field
            // below: the trap is sprung on the server or not at all.
            website: values.website ?? "",
          },
        },
      })
      setAcknowledged(true)
    } catch (error) {
      if (getErrorCode(error) === CONTACT_MESSAGE_RATE_LIMITED) {
        setRateLimited(true)
        return
      }

      // Development only, and deliberately so: a console line is readable by
      // whoever is sitting at the browser, which on a production storefront is
      // the person the identical-answer rule exists to keep in the dark.
      if (process.env.NODE_ENV !== "production") {
        console.error("[contact] send failed; acknowledged anyway:", error)
      }
      setAcknowledged(true)
    }
  }

  if (acknowledged) {
    return (
      <section className="shop-panel p-6 sm:p-8">
        <span
          aria-hidden
          className="grid size-10 place-items-center rounded-full bg-shop-accent-soft text-shop-accent"
        >
          <Check className="size-5" />
        </span>
        <h2 className="mt-4 font-heading text-lg font-semibold tracking-tight">
          {t("sentTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("sentBody", { shop: shopName })}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-5 rounded-full border-shop-hairline bg-card"
          onClick={() => {
            reset()
            setAcknowledged(false)
          }}
        >
          {t("sendAnother")}
        </Button>
      </section>
    )
  }

  return (
    <form
      className="shop-panel flex flex-col gap-5 p-6 sm:p-8"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      {rateLimited && (
        /*
          The one message on this screen that is not the confirmation.
          `role="alert"` rather than a toast: the form stays up with the
          visitor's words still in it, and the reason they are still there has
          to be attached to the thing holding them.
        */
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {t("rateLimited")}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="contact-name"
          label={t("nameLabel")}
          error={errors.name ? tValidation("minName") : null}
        >
          <Input
            id="contact-name"
            autoComplete="name"
            maxLength={CONTACT_NAME_MAX_LENGTH}
            aria-invalid={!!errors.name}
            className="h-11 rounded-xl border-shop-hairline"
            {...register("name")}
          />
        </Field>

        <Field
          id="contact-email"
          label={t("emailLabel")}
          hint={t("emailHint")}
          error={errors.email ? tValidation("email") : null}
        >
          <Input
            id="contact-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            // A Latin address inside an Arabic form reorders around its own
            // punctuation without this, the same reason the footer's phone and
            // email rows carry it.
            dir="ltr"
            aria-invalid={!!errors.email}
            className="h-11 rounded-xl border-shop-hairline"
            {...register("email")}
          />
        </Field>
      </div>

      <Field
        id="contact-order-number"
        label={t("orderNumberLabel")}
        optionalLabel={tCommon("optional")}
        hint={t("orderNumberHint")}
        error={null}
      >
        <Input
          id="contact-order-number"
          autoComplete="off"
          maxLength={CONTACT_ORDER_NUMBER_MAX_LENGTH}
          className="h-11 rounded-xl border-shop-hairline"
          {...register("order_number")}
        />
      </Field>

      <Field
        id="contact-message"
        label={t("messageLabel")}
        error={errors.message ? tValidation("required") : null}
      >
        <Textarea
          id="contact-message"
          rows={7}
          /*
            The cap is spelled in three places and they are one number: here, so
            the box simply stops taking characters; in the zod schema, so a
            paste that outruns the attribute is caught before the network; and
            in the DTO, which is the only one that counts. The counter below is
            what makes the first of them legible rather than mysterious.
          */
          maxLength={CONTACT_MESSAGE_MAX_LENGTH}
          aria-invalid={!!errors.message}
          aria-describedby="contact-message-count"
          className="rounded-xl border-shop-hairline"
          {...register("message")}
        />
        {/*
          Described-by rather than a live region. A counter that announced
          itself on every keystroke would talk over the typing it is counting;
          attached to the field, a screen reader reads it on entry and on
          demand.
        */}
        <p
          id="contact-message-count"
          className="text-end text-xs tabular-nums text-muted-foreground"
        >
          {t("charactersLeft", { count: remaining })}
        </p>
      </Field>

      {/*
        The honeypot.

        Off-screen rather than `display: none` or `hidden`: the cheap form
        fillers skip inputs hidden that way, having learned they are decoys, and
        a trap nobody springs catches nobody. `aria-hidden` on the wrapper plus
        `tabIndex={-1}` on the field keep it away from the people the off-screen
        trick would otherwise drop into a box they cannot see to leave.
        `autoComplete="off"` stops a browser filling it on somebody's behalf,
        which is the one way a real visitor ends up in it.

        The label is real and hidden along with everything else: a form filler
        reads names and labels to decide what a field wants, and `website` on a
        contact form is exactly the plausible thing it is looking for.
        `honeypot` is not.
      */}
      <div
        aria-hidden="true"
        className="absolute top-[-9999px] left-[-9999px] h-px w-px overflow-hidden"
      >
        <label htmlFor="contact-website">{t("websiteLabel")}</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />
      </div>

      <div>
        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="h-11 rounded-full bg-shop-accent px-6 text-base text-shop-accent-foreground hover:bg-shop-accent/90"
        >
          <Send className="size-4" />
          {loading ? t("sending") : t("send")}
        </Button>
      </div>
    </form>
  )
}

/** Label, optional marker, hint and error around one control. */
function Field({
  id,
  label,
  optionalLabel,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  optionalLabel?: string
  hint?: string
  error: string | null
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
        {optionalLabel && (
          <span className="font-normal text-muted-foreground">
            ({optionalLabel})
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
