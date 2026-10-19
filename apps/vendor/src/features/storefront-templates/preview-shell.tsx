"use client"

import { useLocale } from "next-intl"
import { useState, type ComponentType, type CSSProperties } from "react"

import type { CheckoutFrameProps } from "@repo/storefront-templates/checkout-frame"

import { SAMPLE_FIELDS, checkoutSample } from "./checkout-sample"

export function PreviewShell({
  shopName,
  homeHref,
  Frame,
  fontClass,
  fontStyle,
}: {
  shopName: string
  homeHref: string
  Frame: ComponentType<CheckoutFrameProps>
  fontClass?: string
  fontStyle?: CSSProperties
}) {
  const locale = useLocale()
  const lang = locale === "ar" ? "ar" : "en"
  const [placing, setPlacing] = useState(false)
  const props = checkoutSample(
    shopName,
    homeHref,
    () => {
      setPlacing(true)
      window.setTimeout(() => setPlacing(false), 700)
    },
    <div className="tpl-stack">
      <label className="tpl-label">
        {SAMPLE_FIELDS.name}
        <input defaultValue={SAMPLE_FIELDS.nameValue} readOnly />
      </label>
      <label className="tpl-label">
        {SAMPLE_FIELDS.contact}
        <input defaultValue={SAMPLE_FIELDS.contactValue} readOnly />
      </label>
    </div>,
  )
  return <Frame {...props} lang={lang} placing={placing} fontClass={fontClass} fontStyle={fontStyle} />
}
