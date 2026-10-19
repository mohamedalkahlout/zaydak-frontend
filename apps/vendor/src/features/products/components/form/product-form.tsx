"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { sileo } from "sileo"
import {
  productSchema,
  type ProductFormApi,
  type ProductFormInput,
  type ProductFormOutput,
} from "@/features/products/validations/product"
import { productFormDefaults } from "@/features/products/lib/form/form-defaults"
import {
  mergeProductPrefill,
  proposedFromPrefill,
} from "@/features/products/lib/form/merge-prefill"
import {
  clearProductDraft,
  draftOutlivedHandoff,
  readProductDraft,
  type ProductDraft,
} from "@/features/products/lib/form/product-draft"
import { useVendorAgentPrefillStore } from "@/features/ai/store-prefill"
import type { ProductKind } from "@/features/products/lib/list/product-kind-meta"
import type { InitialProductSnapshots } from "@/features/products/lib/form/from-product-entry"
import { useVendorAgentHandoff } from "@/features/ai/lib/use-prefill"
import {
  applyPatchToForm,
  productSnapshot,
  titleIn,
  useLiveForm,
} from "@/features/ai/lib/live-form"
import { AiPrefillProvider } from "@/features/ai/components/ai-prefill-context"
import { ProductFormLayout } from "./product-form-layout"
import { ProductPageHeader } from "./product-page-header"
import { useProductDraft } from "./use-product-draft"
import { useProductSubmit } from "./use-product-submit"
import { BasicsCard } from "./cards/basics-card"
import { PricingCard } from "./cards/pricing-card"
import {
  AssemblyBuilder,
  ASSEMBLED_COMPOSITION,
  EMPTY_COMPOSITION,
  compositionDraftsEqual,
  type CompositionDraft,
} from "./cards/composition-card"
import { AuctionCard } from "./cards/auction-card"
import { NegotiationCard, DEFAULT_NEGOTIATION_DRAFT, draftsEqual, type NegotiationDraft } from "@/features/negotiation/components/negotiation-card"
import { AttributeValuesCard } from "./cards/attribute-values-card"
import { InventoryCard } from "./cards/inventory-card"
import { ShippingCard } from "./cards/shipping-card"
import { VariantsCard } from "./cards/variants-card"
import { useVariantOptions } from "./variants/use-variant-options"
import { SeoCard } from "./cards/seo-card"
import { StatusCard } from "./cards/status-card"
import { PublishingCard } from "./cards/publishing-card"
import { OrganizationCard } from "./cards/organization-card"
import { ProductRelationsCard } from "@/features/product-relations"

interface ProductFormProps {
  mode?: "create" | "edit"
  productId?: string
  /** Edit mode only — the header needs it for the storefront preview link
   *  and to find this product in the list the arrows step through. */
  slug?: string
  initialValues?: ProductFormInput
  initialSnapshots?: InitialProductSnapshots
  /**
   * The kind chosen in the "Add product" dialog, read off `?kind=` by the
   * create route. Create-mode only — in edit mode the saved product is the
   * source of truth. `VARIABLE` seeds no type (see `productFormDefaults`);
   * it opens the variants editor instead.
   */
  initialKind?: ProductKind
  /**
   * The assembled-product form: its own price and choice groups, without
   * the variant, auction and negotiation cards. Create sets this from
   * `?kind=assembled`. Edit sets it when the product already has rules.
   */
  assembled?: boolean
}

/**
 * Decides where the form's starting values come from, then mounts the form.
 *
 * Create mode has three candidates, in this order: a prefill staged by the
 * assistant (a fresh chat handoff outranks anything parked), the draft this
 * tab parked in `sessionStorage` before a reload (`useProductDraft`), and
 * the kind's defaults. Edit mode has one — the server row — and never looks
 * at the draft.
 *
 * The draft is read after mount rather than in an initializer, because the
 * page is server-rendered and web storage does not exist there. Taking it
 * means REMOUNTING the body under a new `key` with the draft as its
 * `defaultValues`, not `form.reset()` into the mounted one: `useVariantOptions`
 * derives its option axes once, in its state initializer, from the values
 * the form started with, so a reset would leave a variant draft with no
 * axes to edit. The one-frame flash of the empty form is the same trade the
 * signup wizard makes.
 */
export function ProductForm(props: ProductFormProps) {
  const { mode = "create", productId, initialValues, initialKind } = props
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""
  // Resolved to strings up here rather than inside the effect: a string is the
  // same value on every render, so the effect below depends on the words and
  // not on the translator object that produced them.
  const tDraft = useTranslations("products.draft")
  const restoredTitle = tDraft("restored")
  const restoredBody = tDraft("restoredBody")
  const startFreshLabel = tDraft("startFresh")

  // AI-prefill from a recent "create_product" or "update_product" chat
  // call. A non-destructive peek, so a second mount re-applies it. For
  // create: merged over the defaults. For edit: merged over the GraphQL
  // snapshot in initialValues so untouched fields keep their current values.
  // The whole ticket, not just its values: its handoff id is what the form
  // registers under as the live form the chat can patch.
  const handoff = useVendorAgentHandoff(
    mode === "edit" ? "product_edit" : "product_create",
    productId,
  )
  const aiPrefill = handoff?.values

  // `undefined` = not decided yet, `null` = nothing to restore. Only an
  // unprefilled create ever looks; the draft hook stays off until it has.
  const restorable = mode === "create" && !aiPrefill
  const [restored, setRestored] = useState<ProductDraft | null | undefined>(
    restorable ? undefined : null,
  )
  // Strict mode runs the effect twice on one mount. The ref survives that
  // simulated remount while a toast does not, so it stops a second one.
  const announced = useRef(false)

  useEffect(() => {
    if (!restorable) return
    const parked = readProductDraft(shopSlug)
    // A draft parked by a form the assistant opened ends with that handoff's
    // ticket. Once the ticket is saved, released or replaced, this is a manual
    // "Add product", and the assistant's half-finished form is not the
    // vendor's draft to restore.
    const outlived =
      parked !== null &&
      draftOutlivedHandoff(
        parked,
        useVendorAgentPrefillStore.getState().pending.product_create?.handoffId,
      )
    if (outlived) clearProductDraft(shopSlug)
    const draft = outlived ? null : parked
    /* eslint-disable-next-line react-hooks/set-state-in-effect --
     * Restoring persisted state after hydration is the one case an effect is
     * still the answer for. A `useState` initializer cannot do it: this page is
     * server-rendered and web storage does not exist there, so reading it in
     * the initializer produces markup the server could never have sent and
     * React throws out the whole tree on a hydration mismatch. Nor is it a
     * `useSyncExternalStore` — this component OWNS the value and writes it
     * back (through `useProductDraft`); storage is where it is parked between
     * visits, not a store it observes.
     */
    setRestored(draft)
    if (!draft || announced.current) return
    announced.current = true
    // Restored regardless of whether `?kind=` matches the draft's kind — the
    // merchant who picked Digital and got last sitting's t-shirt back has the
    // way out right here, and losing the t-shirt silently is the worse trade.
    sileo.info({
      title: restoredTitle,
      description: restoredBody,
      button: {
        title: startFreshLabel,
        onClick: () => {
          clearProductDraft(shopSlug)
          setRestored(null)
        },
      },
    })
  }, [restorable, shopSlug, restoredTitle, restoredBody, startFreshLabel])

  // Spread over the kind's defaults: `undefined`s drop out of JSON, so a
  // draft is sparse where the form expects every key present.
  const draftValues = useMemo(
    () =>
      restored
        ? { ...productFormDefaults(restored.kind), ...restored.values }
        : undefined,
    [restored],
  )

  return (
    <ProductFormBody
      key={restored ? "draft" : "fresh"}
      {...props}
      mode={mode}
      initialValues={draftValues ?? initialValues}
      initialKind={restored?.kind ?? initialKind}
      aiPrefill={aiPrefill}
      handoffId={handoff?.handoffId}
      shopSlug={shopSlug}
      draftEnabled={mode === "create" && restored !== undefined}
      restoredFromDraft={restored != null}
    />
  )
}

interface ProductFormBodyProps extends ProductFormProps {
  aiPrefill: Record<string, unknown> | undefined
  /** The assistant handoff this form was opened from, if any. */
  handoffId: string | undefined
  shopSlug: string
  /** Off until the shell has decided whether there is a draft to restore. */
  draftEnabled: boolean
  /** The defaults came from a parked draft, so pristine is still unsaved. */
  restoredFromDraft: boolean
}

function ProductFormBody({
  mode = "create",
  productId,
  slug,
  initialValues,
  initialSnapshots,
  initialKind,
  assembled = false,
  aiPrefill,
  handoffId,
  shopSlug,
  draftEnabled,
  restoredFromDraft,
}: ProductFormBodyProps) {
  const assembledForm = assembled || initialKind === "ASSEMBLED"
  const compositionStart = assembledForm ? ASSEMBLED_COMPOSITION : EMPTY_COMPOSITION
  const t = useTranslations("products")
  const tValidation = useTranslations("products.validation")
  const locale = useLocale()

  // One level deep, except the `{ en, ar }` fields, which merge per locale: a
  // prefill renaming only the Arabic title must not blank the English one.
  const mergedDefaults = useMemo(
    () =>
      mergeProductPrefill<ProductFormInput>(
        initialValues ?? productFormDefaults(initialKind),
        aiPrefill,
      ),
    [initialValues, initialKind, aiPrefill],
  )

  // What the assistant has patched into this form since it opened — the live
  // form channel. Kept beside the prefill rather than folded into it, because
  // the prefill is the mount-time ticket and this is what came after.
  const [patched, setPatched] = useState<Record<string, unknown>>({})

  // The merge above produces the right values and no record of where any of
  // them came from, which is why nothing downstream could say "the assistant
  // wrote this one". The proposed values are what `AiPrefillProvider` marks
  // against: a field keeps its mark while it still holds one of them. A
  // translatable is the merged pair the form holds, not the one locale sent.
  const proposed = useMemo(
    () => ({ ...proposedFromPrefill(mergedDefaults, aiPrefill), ...patched }),
    [mergedDefaults, aiPrefill, patched],
  )

  // Built from the translator so its messages come out in the dashboard's
  // language; memoised on it so the resolver is not rebuilt every render.
  const schema = useMemo(() => productSchema(tValidation), [tValidation])
  const form = useForm<ProductFormInput, unknown, ProductFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: mergedDefaults,
  })
  const api = form as unknown as ProductFormApi

  // While this form is one the assistant prepared, it is the live form: each
  // chat message carries its values, and a `patch_form` result is staged
  // into it here — `setValue` with `shouldDirty`, so the save bar shows and
  // nothing is saved until the vendor presses Save. A form the vendor opened
  // themselves has no handoff id and never registers.
  useLiveForm({
    formId: handoffId,
    target: mode === "edit" ? "product_edit" : "product_create",
    entityId: mode === "edit" ? productId : undefined,
    // What the chat's composer chip calls this form: the product's saved
    // title. A create form has none and reads "New product" there.
    label: mode === "edit" ? titleIn(initialValues?.name, locale) : undefined,
    snapshot: () => productSnapshot(api.getValues() as Record<string, unknown>),
    apply: (values) => {
      const applied = applyPatchToForm(api, values)
      setPatched((prev) => ({ ...prev, ...applied }))
      return applied
    },
  })

  // Lifted so the metafield card can promote a SELECT/MULTI_SELECT
  // attribute into a variant axis via `connectAttribute`.
  const variants = useVariantOptions(api, {
    startWithAxis: mode === "create" && initialKind === "VARIABLE",
  })
  const [negotiationDraft, setNegotiationDraft] = useState<NegotiationDraft>(
    DEFAULT_NEGOTIATION_DRAFT,
  )
  const [negotiationBaseline, setNegotiationBaseline] =
    useState<NegotiationDraft>(DEFAULT_NEGOTIATION_DRAFT)
  const negotiationDirty = !draftsEqual(negotiationDraft, negotiationBaseline)
  const [compositionDraft, setCompositionDraft] =
    useState<CompositionDraft>(compositionStart)
  const [compositionBaseline, setCompositionBaseline] =
    useState<CompositionDraft>(compositionStart)
  const compositionDirty = !compositionDraftsEqual(
    compositionDraft,
    compositionBaseline,
  )

  const { submit, onInvalid, loading } = useProductSubmit(
    mode === "edit" && productId
      ? { kind: "edit", id: productId }
      : { kind: "create" },
    api,
    {
      getNegotiationDraft: () => negotiationDraft,
      getNegotiationBaseline: () => negotiationBaseline,
      onNegotiationSaved: (saved) => {
        setNegotiationDraft(saved)
        setNegotiationBaseline(saved)
      },
    },
    {
      getDraft: () => compositionDraft,
      getBaseline: () => compositionBaseline,
      onSaved: (saved) => {
        setCompositionDraft(saved)
        setCompositionBaseline(saved)
      },
    },
  )
  useProductDraft({
    form: api,
    shopSlug,
    kind: initialKind ?? "SIMPLE",
    enabled: draftEnabled,
    submitting: loading,
    restored: restoredFromDraft,
    handoffId,
  })

  return (
    <AiPrefillProvider
      handoff={aiPrefill !== undefined}
      proposed={proposed}
      control={form.control}
    >
    <ProductFormLayout
      title={
        mode === "edit"
          ? t(assembledForm ? "editAssembled" : "editProduct")
          : t(assembledForm ? "addAssembled" : "addProduct")
      }
      saving={loading}
      form={api}
      onValid={submit}
      onInvalid={onInvalid}
      unsavedLabel={
        mode === "edit" ? t("unsavedChanges") : t("unsavedProduct")
      }
      forceDirty={restoredFromDraft || negotiationDirty || compositionDirty}
      beforeDiscard={
        mode === "create"
          ? () => {
              clearProductDraft(shopSlug)
              setNegotiationDraft(DEFAULT_NEGOTIATION_DRAFT)
              setNegotiationBaseline(DEFAULT_NEGOTIATION_DRAFT)
              setCompositionDraft(compositionStart)
              setCompositionBaseline(compositionStart)
            }
          : () => {
              setNegotiationDraft(negotiationBaseline)
              setCompositionDraft(compositionBaseline)
            }
      }
      header={
        mode === "edit" && productId && slug ? (
          <ProductPageHeader form={api} productId={productId} slug={slug} />
        ) : undefined
      }
      sidebar={
        <>
          <StatusCard form={api} />
          <PublishingCard form={api} />
          <OrganizationCard form={api} snapshots={initialSnapshots} />
        </>
      }
    >
      {/* Same reason as the metafields card below: the taxonomy query takes a
          locale and defaults to English, so the picker would browse an English
          tree on an Arabic dashboard. */}
      <BasicsCard form={api} snapshots={initialSnapshots} locale={locale} />
      {assembledForm ? (
        <AssemblyBuilder
          form={api}
          productId={productId}
          draft={compositionDraft}
          baseline={compositionBaseline}
          onChange={setCompositionDraft}
          onBaseline={setCompositionBaseline}
        />
      ) : (
        <PricingCard form={api} />
      )}
      {assembledForm ? null : (
        <>
          <AuctionCard form={api} />
          <NegotiationCard
            form={api}
            productId={productId}
            draft={negotiationDraft}
            onChange={setNegotiationDraft}
            onBaselineChange={setNegotiationBaseline}
            locale={locale}
          />
        </>
      )}
      <InventoryCard form={api} productId={productId} />
      <ShippingCard form={api} />
      {assembledForm ? null : (
        <VariantsCard form={api} variants={variants} productId={productId} />
      )}
      {assembledForm ? null : (
      <AttributeValuesCard
        form={api}
        variants={variants}
        snapshots={initialSnapshots?.attributes}
        // `categoryAttributes` and `suggestProductAttributes` both take a
        // locale and both default to English on the server, so without this the
        // Arabic dashboard drew Arabic chrome around English field names.
        locale={locale}
      />
      )}
      {/* Cross-sells / upsells — edit-mode only (needs a saved productId
          as the relation source). The card silently no-ops in create mode. */}
      <ProductRelationsCard productId={productId} />
      <SeoCard form={api} />
    </ProductFormLayout>
    </AiPrefillProvider>
  )
}
