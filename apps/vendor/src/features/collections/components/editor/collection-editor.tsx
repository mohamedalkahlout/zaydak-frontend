"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useForm, useFormState, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { cn } from "@/shared/lib/utils"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { mergePrefill, proposedFromPrefill } from "@/shared/lib/merge-prefill"
import { AiPrefillProvider } from "@/features/ai/components/ai-prefill-context"
import { useVendorAgentHandoff } from "@/features/ai/lib/use-prefill"
import { useLiveForm } from "@/features/ai/lib/live-form"
import {
  applyCollectionPatch,
  collectionSnapshot,
} from "@/features/collections/lib/live-form"
import {
  LangTabsBar,
  LocaleProvider,
} from "@/features/products/components/form/ui/lang-tabs"
import {
  COLLECTION_TRANSLATABLE_FIELDS,
  collectionFormDefaults,
  collectionToForm,
  newCondition,
  newSource,
} from "@/features/collections/lib/rules"
import {
  MAX_TOTAL_CONDITIONS,
  collectionFormSchema,
  countConditions,
  type CollectionFormApi,
  type CollectionFormInput,
  type SourceInput,
} from "@/features/collections/validations/shop-collection"
import type { CollectionItem, ShopCollection } from "@/features/collections/types"
import { CollectionPageHeader } from "./collection-page-header"
import { DetailsCard } from "./details-card"
import { ItemsCard } from "./items-card"
import { ProductPickerDialog } from "./product-picker-dialog"
import { SeoCard } from "./seo-card"
import { SourcesPanel } from "./sources-panel"
import { useCollectionEditor } from "./use-collection-editor"

/** What an embedded host supplies in place of the route's own page chrome. */
export interface EmbeddedCollectionEditor {
  /** Replaces `CollectionPageHeader`; gets the commit controls to wire up. */
  header: (api: { submit: () => void; loading: boolean }) => React.ReactNode
  /** Called with the new collection rather than navigating to its page. */
  onCreated: (collection: ShopCollection) => void
  /**
   * Reports the form's `isDirty` to the host, which is the only way it can know
   * whether closing throws work away — the global save bar, which does that job
   * on the route, is the host's own here.
   */
  onDirtyChange?: (dirty: boolean) => void
  /**
   * Reports whether a create/update mutation is currently in flight to the host,
   * so it can block dismissal or disable controls while saving.
   */
  onLoadingChange?: (loading: boolean) => void
  /**
   * Tailwind `top-*` class for the sources column's sticky offset, measured
   * against the host's scroll container. Omit to leave the column in flow: the
   * route's `lg:top-20` is the site header's height and means nothing inside
   * someone else's dialog.
   */
  stickyTop?: string
}

/**
 * One screen for creating and for editing, because they are the same screen:
 * a collection is its title, its cover, the sources it draws from, and the
 * items that fall out of them. Nothing here saves on its own — every control
 * stages into the form and the global save bar is the one commit point.
 *
 * `embedded` is that same screen inside someone else's dialog, and it changes
 * four things that all follow from not owning the page any more. The header
 * comes from the host, because the route's own carries a breadcrumb out and
 * actions (Duplicate, View, Delete) that are all dead on a collection that does
 * not exist yet. The global save bar is left alone, because the host's form is
 * already using it — two screens driving one bar is one screen's Save
 * discarding the other's; `onDirtyChange` hands the host the one thing that bar
 * was telling the vendor, so it can ask before its close throws the form away.
 * The sources column's sticky offset comes from the host too (`stickyTop`),
 * since the scrolling element is theirs. And the root is a plain `div`: a
 * dialog portals to the body, but React events still travel the React tree, so
 * a nested `form` would fire the host form's own `onSubmit` on the way past.
 *
 * The EN/AR switch follows the same rule. On its own route the editor owns a
 * `LocaleProvider` and the floating pill that drives it, so the title,
 * description and SEO inputs edit one locale at a time the way the product
 * form's do. Embedded, it mounts neither: the drawer is rendered inside the
 * product form's provider (context crosses the portal, being React tree and
 * not DOM), so the host's pill already switches these inputs, and a second
 * pill would be two answers to "which language am I typing".
 */
export function CollectionEditor({
  collection,
  pinnedProductIds = [],
  embedded,
}: {
  collection?: ShopCollection
  pinnedProductIds?: string[]
  embedded?: EmbeddedCollectionEditor
}) {
  const t = useTranslations("collections")
  const tv = useTranslations("collections.validation")
  const params = useParams<{ shopSlug: string }>()
  const backHref = `/store/${params?.shopSlug ?? ""}/products/collections`

  // The handoff a recent "create_collection" chat call staged, if any. Its
  // values merge into the defaults one level deep, except the `{ en, ar }`
  // fields, per locale; its id is what the form registers under below.
  const handoff = useVendorAgentHandoff("collection_create")
  const aiPrefill = handoff?.values
  const defaults = useMemo<CollectionFormInput>(() => {
    if (collection) return collectionToForm(collection, pinnedProductIds)
    return mergePrefill(
      collectionFormDefaults(),
      aiPrefill,
      COLLECTION_TRANSLATABLE_FIELDS,
    )
  }, [collection, pinnedProductIds, aiPrefill])

  // What the assistant has patched in since the form opened. Kept beside the
  // prefill: the prefill is the mount-time ticket, and this is what came after.
  const [patched, setPatched] = useState<Record<string, unknown>>({})
  const proposed = useMemo(
    () => ({
      ...proposedFromPrefill(
        defaults,
        aiPrefill,
        COLLECTION_TRANSLATABLE_FIELDS,
      ),
      ...patched,
    }),
    [defaults, aiPrefill, patched],
  )

  const form = useForm<CollectionFormInput>({
    resolver: zodResolver(collectionFormSchema(tv)),
    defaultValues: defaults,
  }) as CollectionFormApi

  // While this is the create form the assistant prepared, it is the live
  // form: each chat message carries its title, description and handle, and a
  // `patch_form` result is staged into it — dirty, nothing saved until Save.
  // Not on an edit, which no card opens, and not embedded in the product
  // form's drawer, where the live slot belongs to the form around it.
  useLiveForm({
    formId: collection || embedded ? undefined : handoff?.handoffId,
    target: "collection_create",
    snapshot: () =>
      collectionSnapshot(form.getValues() as Record<string, unknown>),
    apply: (values) => {
      const applied = applyCollectionPatch(form, values)
      setPatched((prev) => ({ ...prev, ...applied }))
      return applied
    },
  })

  const { submit, onInvalid, loading } = useCollectionEditor({
    form,
    collection,
    onCreated: embedded?.onCreated,
  })
  const handleSubmit = form.handleSubmit(submit, onInvalid)

  const [pickerOpen, setPickerOpen] = useState(false)
  const manualIds = (useWatch({
    control: form.control,
    name: "product_ids",
  }) ?? []) as string[]

  const { isDirty } = useFormState({ control: form.control })
  const showBar = useUnsavedBarStore((s) => s.show)
  const hideBar = useUnsavedBarStore((s) => s.hide)

  // Destructured, not read off `embedded` inside the effect: the host builds
  // that object literal fresh on every render of its own, so the whole object
  // as a dependency would re-run this on every keystroke.
  const onDirtyChange = embedded?.onDirtyChange
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [onDirtyChange, isDirty])

  const onLoadingChange = embedded?.onLoadingChange
  useEffect(() => {
    onLoadingChange?.(loading)
  }, [onLoadingChange, loading])

  useEffect(() => {
    // Embedded, the bar on screen is the host form's. Registering over it would
    // put this screen's Save on a bar labelled for theirs.
    if (embedded) return
    // Create mode has nothing to go back to, so the bar is always available;
    // edit mode follows the house rule and appears only once something moved.
    if (collection && !isDirty) {
      hideBar()
      return
    }
    showBar({
      label: t("unsavedChanges"),
      saving: loading,
      discardHref: collection ? undefined : backHref,
      onDiscard: collection ? () => form.reset(defaults) : undefined,
      onSave: handleSubmit,
    })
  })

  useEffect(() => () => hideBar(), [hideBar])

  /**
   * The shortcuts the empty items panel offers on hover. They are the same two
   * actions the sources panel carries — a condition lands on the first source
   * that selects by condition, because that is the one the preview is already
   * showing, and picking products opens the collection's single hand-picked
   * set. Neither is a second way to store membership, just a shorter route to
   * the one that exists.
   */
  const addCondition = () => {
    const sources = form.getValues("sources")
    // The items card disables its button at the cap; this is the same line
    // read from the form itself, so the shortcut can never push past it.
    if (countConditions(sources) >= MAX_TOTAL_CONDITIONS) return
    const index = sources.findIndex((source) => source.kind === "PRODUCTS")
    const target = sources[index]
    if (!target) {
      form.setValue(
        "sources",
        [...sources, { ...newSource(), conditions: [newCondition()] }],
        { shouldDirty: true },
      )
      return
    }
    const next: SourceInput[] = [...sources]
    next[index] = {
      ...target,
      conditions: [...target.conditions, newCondition()],
    }
    form.setValue("sources", next, { shouldDirty: true })
  }

  /**
   * The × on an item does what actually keeps it out: un-picks it when a human
   * put it there, and records an exclusion when a condition did — otherwise
   * the next sync would hand it straight back.
   */
  const removeItem = (item: CollectionItem) => {
    if (item.pinned) {
      const current = form.getValues("product_ids")
      form.setValue(
        "product_ids",
        current.filter((id) => id !== item.id),
        { shouldDirty: true },
      )
      return
    }
    const sources = form.getValues("sources")
    const first = sources[0]
    if (!first) return
    const next: SourceInput[] = [...sources]
    next[0] = {
      ...first,
      exclude: {
        ...first.exclude,
        product_ids: [...new Set([...first.exclude.product_ids, item.id])],
      },
    }
    form.setValue("sources", next, { shouldDirty: true })
  }

  const Root = embedded ? "div" : "form"

  const screen = (
    <Root
      {...(embedded ? {} : { onSubmit: handleSubmit })}
      className="flex flex-col gap-4"
    >
      {embedded
        ? embedded.header({ submit: handleSubmit, loading })
        : <CollectionPageHeader form={form} collection={collection} />}

      {!embedded && <LangTabsBar />}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <DetailsCard form={form} />
          <ItemsCard
            form={form}
            onRemoveItem={removeItem}
            onAddCondition={addCondition}
            onAddProducts={() => setPickerOpen(true)}
          />
          <SeoCard form={form} />
        </div>

        {/*
          `lg:top-20` is the route's own 64px site header plus 16px. Embedded,
          the element that scrolls belongs to the host and so does the sticky
          thing above this one, so the offset is theirs to name; without one the
          column simply scrolls with the page rather than pinning under a header
          that is not there.
        */}
        <div
          className={
            embedded
              ? cn(embedded.stickyTop && "lg:sticky", embedded.stickyTop)
              : "lg:sticky lg:top-20"
          }
        >
          <SourcesPanel form={form} collectionId={collection?.id} />
        </div>
      </div>

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={manualIds}
        onConfirm={(ids) =>
          form.setValue("product_ids", ids, { shouldDirty: true })
        }
      />
    </Root>
  )

  // Edit, and the product-form drawer, are not a collection handoff. The
  // provider is still mounted so this form does not inherit the product
  // form's marks onto title and description.
  const body = (
    <AiPrefillProvider
      handoff={!collection && !embedded && aiPrefill !== undefined}
      proposed={proposed}
      control={form.control}
    >
      {screen}
    </AiPrefillProvider>
  )

  return embedded ? body : <LocaleProvider>{body}</LocaleProvider>
}
