"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { useForm, useFormState } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { sileo } from "sileo"
import { AlertCircleIcon, SparklesIcon, UndoIcon } from "lucide-react"
import {
  CREATE_SEGMENT,
  DESCRIBE_SEGMENT,
  GET_CUSTOMER_BASE_COUNT,
  GET_SEGMENTS,
  PREVIEW_SEGMENT,
  UPDATE_SEGMENT,
} from "@/features/segments/api"
import type {
  CreateSegmentResponse,
  CustomerBaseCountResponse,
  DescribeSegmentResponse,
  PreviewSegmentResponse,
  Segment,
  SegmentTemplate,
  UpdateSegmentResponse,
} from "@/features/segments/types"
import { SAMPLE_SIZE } from "@/features/segments/lib/constants"
import {
  segmentFormSchema,
  type SegmentFormInput,
  type SegmentFormOutput,
} from "@/features/segments/validations/segment"
import { useQueryHistory } from "@/features/segments/lib/use-query-history"
import { useEditorState } from "@/features/segments/lib/use-editor-state"
import { serializeShopifyQL } from "@/features/segments/lib/shopifyql"
import { useSegmentEditorStore } from "@/features/segments/stores/editor-store"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { cn } from "@/shared/lib/utils"
import { SegmentPageHeader } from "./segment-page-header"
import { SaveSegmentDialog } from "./save-segment-dialog"
import { EditorStatsBar } from "./editor-stats-bar"
import { DescribePrompt } from "./describe-prompt"
import { RefinementPanel } from "./refinement-panel"
import { CustomersPreview } from "./customers-preview"
import { TemplatesPicker } from "./templates-picker"
import { QueryChips } from "./query-chips"

// CodeMirror (6 @codemirror/* packages) only mounts on this editor screen, and it
// needs the DOM — load it on demand instead of in the segments route bundle.
const ShopifyQLCodeMirrorEditor = dynamic(
  () =>
    import("./shopifyql-codemirror-editor").then(
      (m) => m.ShopifyQLCodeMirrorEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="min-h-32 animate-pulse rounded-md border border-border bg-muted/30"
      />
    ),
  },
)

interface SegmentEditorProps {
  mode: "create" | "edit"
  segment?: Segment
}

const URL_QUERY_PARAM = "segment_query"

/**
 * Shopify-style segment editor.
 *
 *   [Page header: breadcrumb + Duplicate / More actions / Use segment]
 *   [Details card: name + description]
 *   [Editor card]
 *     ├ stats bar (count + % + Templates + undo/redo + Run + collapse)
 *     ├ AI description (italic + purple vertical rule)
 *     ├ ShopifyQL editor (line-numbered, FROM/SHOW/WHERE/ORDER BY frame)
 *     └ Refine prompt
 *   [Customers preview table]
 *
 * Sticky unsaved bar at the top of the page (via useUnsavedBarStore) when
 * the form is dirty. URL syncs `?segment_query=` for shareability.
 */
export function SegmentEditor({ mode, segment }: SegmentEditorProps) {
  const t = useTranslations("segments.editor")
  const tv = useTranslations("segments.validation")
  // The AI endpoints (describe / explain / generate) and the templates answer
  // in English or Arabic; ask for the dashboard's own language.
  const aiLocale = useLocale() === "ar" ? "ar" : "en"
  const router = useRouter()
  const params = useParams<{ shopSlug: string }>()
  const searchParams = useSearchParams()
  const shopSlug = params?.shopSlug ?? ""

  const initialQuery =
    segment?.query ?? searchParams?.get(URL_QUERY_PARAM) ?? ""

  const defaults: SegmentFormInput = {
    name: segment?.name ?? "",
    description: segment?.description ?? "",
    query: initialQuery,
  }

  const form = useForm<SegmentFormInput, unknown, SegmentFormOutput>({
    resolver: zodResolver(segmentFormSchema(tv)),
    defaultValues: defaults,
  })

  const queryValue = form.watch("query")
  const nameValue = form.watch("name")
  // Drives the page layout: empty → just the "Describe your segment" prompt;
  // non-empty → the full editor frame (matching Shopify).
  const hasQuery = queryValue.trim().length > 0

  // ─── Undo / redo history ─────────────────────────────────────────────
  const history = useQueryHistory(initialQuery)
  useEffect(() => {
    history.push(queryValue)
  }, [history, queryValue])

  const handleUndo = useCallback(() => {
    const prev = history.undo()
    if (prev !== null) form.setValue("query", prev, { shouldDirty: true })
  }, [history, form])

  const handleRedo = useCallback(() => {
    const next = history.redo()
    if (next !== null) form.setValue("query", next, { shouldDirty: true })
  }, [history, form])

  // ─── Editor chrome state (Zustand slice) ─────────────────────────────
  // Extracted from the orchestrator so each consumer subscribes to just
  // the slice it cares about. See `stores/editor-store.ts`.
  const debouncedQuery = useSegmentEditorStore((s) => s.debouncedQuery)
  const setDebouncedQuery = useSegmentEditorStore((s) => s.setDebouncedQuery)
  const runNonce = useSegmentEditorStore((s) => s.runNonce)
  const bumpRunNonce = useSegmentEditorStore((s) => s.bumpRunNonce)
  const collapsed = useSegmentEditorStore((s) => s.collapsed)
  const toggleCollapsed = useSegmentEditorStore((s) => s.toggleCollapsed)
  const templatesOpen = useSegmentEditorStore((s) => s.templatesOpen)
  const setTemplatesOpen = useSegmentEditorStore((s) => s.setTemplatesOpen)
  const resetEditorStore = useSegmentEditorStore((s) => s.reset)

  // ─── AST-first state (Phase 10A) ─────────────────────────────────────
  // The hook derives a live AST from the textarea's text. The chip overlay
  // (QueryChips) mutates the AST via the helpers in `lib/shopifyql`; the
  // hook re-serializes and writes the canonical text back to RHF.
  // We pass `queryValue` so the hook re-syncs when external sources
  // (templates, AI generation, undo/redo) change the query underneath us.
  const editor = useEditorState({
    initialText: queryValue,
    onTextChange: (next) => {
      if (next !== form.getValues("query")) {
        form.setValue("query", next, { shouldDirty: true })
      }
    },
  })

  // Reset the editor store when the route's initial query changes (e.g.
  // navigating between two saved segments without unmounting the layout).
  useEffect(() => {
    resetEditorStore(initialQuery)
  }, [initialQuery, resetEditorStore])

  // Manual-run model: editing the query no longer fires a preview request on
  // every keystroke. `debouncedQuery` (the query the preview/describe/explain
  // requests actually use) only advances on mount (initial query) and when the
  // vendor presses Run / Ctrl+Enter — see `handleRun`. `hasUnrunChanges` below
  // surfaces "edited, not yet run" in the stats bar.
  const hasUnrunChanges =
    queryValue.trim().length > 0 && queryValue.trim() !== debouncedQuery.trim()

  const urlSyncRef = useRef<string>(initialQuery)
  useEffect(() => {
    if (urlSyncRef.current === debouncedQuery) return
    urlSyncRef.current = debouncedQuery
    const next = new URLSearchParams(searchParams?.toString() ?? "")
    if (debouncedQuery) next.set(URL_QUERY_PARAM, debouncedQuery)
    else next.delete(URL_QUERY_PARAM)
    const qs = next.toString()
    router.replace(qs ? `?${qs}` : "?", { scroll: false })
  }, [debouncedQuery, router, searchParams])

  // ─── Preview + description + base count ──────────────────────────────
  const skipPreview = !debouncedQuery.trim()

  const {
    data: previewData,
    loading: previewLoading,
    error: previewError,
    refetch: refetchPreview,
  } = useQuery<PreviewSegmentResponse>(PREVIEW_SEGMENT, {
    variables: { query: debouncedQuery, sampleSize: SAMPLE_SIZE },
    skip: skipPreview,
    fetchPolicy: "cache-and-network",
  })

  const { data: descData } = useQuery<DescribeSegmentResponse>(
    DESCRIBE_SEGMENT,
    {
      variables: { query: debouncedQuery, locale: aiLocale },
      skip: skipPreview,
      fetchPolicy: "cache-and-network",
    },
  )

  const { data: baseData } = useQuery<CustomerBaseCountResponse>(
    GET_CUSTOMER_BASE_COUNT,
    { fetchPolicy: "cache-first" },
  )

  const handleRun = useCallback(() => {
    if (!queryValue.trim()) return
    setDebouncedQuery(queryValue)
    bumpRunNonce()
    if (!skipPreview) void refetchPreview()
  }, [bumpRunNonce, queryValue, refetchPreview, setDebouncedQuery, skipPreview])

  const preview = previewData?.previewCustomerSegment
  const description = descData?.describeCustomerSegment?.description
  const baseCount = baseData?.contacts?.meta?.total ?? null

  // Prefill sentinel for the DescribePrompt input — bumped by chips in the
  // RefinementPanel and reset on next tick so the same chip can fire again.
  const [promptPrefill, setPromptPrefill] = useState("")

  // "Save as new segment" dialog — in create mode the name isn't on the page
  // (Shopify-style), so Save opens this dialog to capture it first.
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  // Synchronous in-flight guard so a rapid double submit (Enter + click before
  // the `creating` loading flag catches up) can't fire two create mutations.
  const confirmingRef = useRef(false)

  // ─── Save / discard / unsaved bar ────────────────────────────────────
  const [createSegment, { loading: creating }] =
    useMutation<CreateSegmentResponse>(CREATE_SEGMENT, {
      refetchQueries: [
        { query: GET_SEGMENTS, variables: { page: 1, limit: 50 } },
      ],
    })
  const [updateSegment, { loading: updating }] =
    useMutation<UpdateSegmentResponse>(UPDATE_SEGMENT)
  const submitting = creating || updating

  const onSubmit = useCallback(
    async (values: SegmentFormOutput) => {
      try {
        if (mode === "create") {
          const { data } = await createSegment({
            variables: {
              input: {
                name: values.name,
                description: values.description || undefined,
                query: values.query,
              },
            },
          })
          const newId = data?.createCustomerSegment?.data?.id
          if (newId) {
            sileo.success({
              title: t("created"),
              description: values.name,
            })
            router.push(`/store/${shopSlug}/segments/${newId}`)
            return
          }
          sileo.error({
            title: t("createFailed"),
            description:
              data?.createCustomerSegment?.message ?? t("tryAgain"),
          })
        } else if (segment) {
          const { data } = await updateSegment({
            variables: {
              input: {
                id: segment.id,
                name: values.name,
                description: values.description || undefined,
                query: values.query,
              },
            },
          })
          if (data?.updateCustomerSegment?.success) {
            sileo.success({
              title: t("updated"),
              description: values.name,
            })
            form.reset({
              name: values.name,
              description: values.description ?? "",
              query: values.query,
            })
            return
          }
          sileo.error({
            title: t("updateFailed"),
            description:
              data?.updateCustomerSegment?.message ?? t("tryAgain"),
          })
        }
      } catch (err) {
        sileo.error({
          title:
            mode === "create" ? t("createFailedShort") : t("updateFailedShort"),
          description: err instanceof Error ? err.message : t("tryAgain"),
        })
      }
    },
    [createSegment, form, mode, router, segment, shopSlug, t, updateSegment],
  )

  const submit = useMemo(
    () => form.handleSubmit(onSubmit),
    [form, onSubmit],
  )

  // Save entry point used by both the sticky unsaved bar and the form's
  // native submit. In create mode (no name field on the page) it pops the
  // "Save as new segment" dialog; in edit mode it submits straight away.
  const handleSave = useCallback(() => {
    if (mode === "create") {
      if (!queryValue.trim()) {
        sileo.error({
          title: t("addQueryFirst"),
          description: t("addQueryFirstBody"),
        })
        return
      }
      setSaveDialogOpen(true)
      return
    }
    void submit()
  }, [mode, queryValue, submit, t])

  // Confirm handler from the Save dialog — drops the chosen name into the
  // form and submits, reusing the create branch of `onSubmit` (toast +
  // redirect). On success `onSubmit` navigates away and unmounts the dialog;
  // on failure it surfaces a toast and the dialog stays open to retry.
  const handleConfirmName = useCallback(
    async (name: string) => {
      if (confirmingRef.current) return
      confirmingRef.current = true
      try {
        form.setValue("name", name, {
          shouldValidate: true,
          shouldDirty: true,
        })
        await submit()
      } finally {
        confirmingRef.current = false
      }
    },
    [form, submit],
  )

  const { isDirty } = useFormState({ control: form.control })
  const showUnsavedBar = useUnsavedBarStore((s) => s.show)
  const updateUnsavedBar = useUnsavedBarStore((s) => s.update)
  const hideUnsavedBar = useUnsavedBarStore((s) => s.hide)
  const unsavedBarActive = useUnsavedBarStore((s) => s.active)

  useEffect(() => {
    if (!isDirty) {
      hideUnsavedBar()
      return
    }
    const config = {
      label: mode === "create" ? t("unsavedSegment") : t("unsavedChanges"),
      saving: submitting,
      discardHref: `/store/${shopSlug}/segments`,
      onSave: handleSave,
    }
    if (!unsavedBarActive) {
      showUnsavedBar(config)
    } else {
      updateUnsavedBar(config)
    }
  }, [
    isDirty,
    mode,
    shopSlug,
    handleSave,
    submitting,
    showUnsavedBar,
    updateUnsavedBar,
    hideUnsavedBar,
    unsavedBarActive,
    t,
  ])

  useEffect(() => () => hideUnsavedBar(), [hideUnsavedBar])

  // ─── Templates picker ────────────────────────────────────────────────
  // Open/close state lives in `useSegmentEditorStore` so the page header's
  // "Templates" button can open it without prop-drilling.
  const handleApplyTemplate = (template: SegmentTemplate) => {
    form.setValue("query", template.query, { shouldDirty: true })
    if (!form.getValues("name")) {
      form.setValue("name", template.name[aiLocale], { shouldDirty: true })
    }
    if (!form.getValues("description")) {
      form.setValue("description", template.description[aiLocale], {
        shouldDirty: true,
      })
    }
  }

  const queryError = form.formState.errors.query?.message
  const nameError = form.formState.errors.name?.message

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSave()
      }}
      className="flex flex-col gap-4"
      data-segment-editor-runnonce={runNonce}
    >
      <SegmentPageHeader
        mode={mode}
        segment={segment}
        currentQuery={queryValue}
        currentName={nameValue}
      />

      {/* Details card — edit mode only. In create mode the name is captured
          by the "Save as new segment" dialog (Shopify-style), so the page
          has no name/description form of its own. */}
      {mode === "edit" && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="segment-name">{t("nameLabel")}</Label>
              <Input
                id="segment-name"
                {...form.register("name")}
                placeholder={t("namePlaceholder")}
              />
              {nameError && (
                <p className="text-xs text-destructive">{nameError}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="segment-description">
                {t("descriptionLabel")}
              </Label>
              <Input
                id="segment-description"
                {...form.register("description")}
                placeholder={t("descriptionPlaceholder")}
              />
            </div>
          </div>
        </div>
      )}

      {/* Empty state — just the "Describe your segment" prompt, matching
          Shopify. The editor frame appears only once there's a query. The
          template shortcut keeps the picker reachable here (the stats-bar
          Templates button only exists once the frame is shown). */}
      {!hasQuery && (
        <>
          <DescribePrompt
            currentQuery={queryValue}
            onGenerated={(q) =>
              form.setValue("query", q, { shouldDirty: true })
            }
            locale={aiLocale}
            prefill={promptPrefill}
          />
          <div className="flex justify-center gap-1">
            {history.canUndo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={handleUndo}
              >
                <UndoIcon className="mr-1 size-3.5" />
                {t("undo")}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setTemplatesOpen(true)}
            >
              <SparklesIcon className="mr-1 size-3.5" />
              {t("startFromTemplate")}
            </Button>
          </div>
        </>
      )}

      {/* Editor frame — stats bar, AI description, query editor, and the
          inline "Refine your segment" prompt docked at the bottom (like
          Shopify's Sidekick). Only shown once there's a query. */}
      {hasQuery && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <EditorStatsBar
            count={preview?.count ?? null}
            totalBaseCount={baseCount}
            loading={previewLoading}
            onTemplates={() => setTemplatesOpen(true)}
            onRun={handleRun}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapsed}
            unrun={hasUnrunChanges}
          />

          {!collapsed && (
            <div className="flex flex-col">
              {description && (
                <div className="flex gap-2 px-4 py-3 text-sm italic text-muted-foreground">
                  <span className="w-0.5 shrink-0 self-stretch rounded-full bg-purple-400" />
                  <span>{description}</span>
                </div>
              )}

              <div className="px-4 pb-4">
                {editor.canRenderAsChips && editor.conditions.length > 0 && (
                  <QueryChips
                    ast={editor.ast!}
                    conditions={editor.conditions}
                    topLogic={editor.topLogic}
                    onAstChange={(nextAst) => {
                      const nextText = nextAst
                        ? serializeShopifyQL(nextAst)
                        : ""
                      form.setValue("query", nextText, { shouldDirty: true })
                      if (nextAst) editor.setFromAst(nextAst)
                      else editor.setText("")
                    }}
                    className="mb-2"
                  />
                )}
                <ShopifyQLCodeMirrorEditor
                  value={queryValue}
                  onChange={(v) => {
                    form.setValue("query", v, { shouldDirty: true })
                    editor.setText(v)
                  }}
                  onRun={handleRun}
                  errorMessage={queryError}
                />

                {previewError && (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                    <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
                    <div>
                      <p className="font-medium">{t("queryError")}</p>
                      <p className="mt-0.5">{previewError.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Inline "Refine your segment" prompt — docked at the bottom
                  of the editor frame, matching Shopify. */}
              <DescribePrompt
                variant="inline"
                currentQuery={queryValue}
                onGenerated={(q) =>
                  form.setValue("query", q, { shouldDirty: true })
                }
                locale={aiLocale}
                prefill={promptPrefill}
              />
            </div>
          )}
        </div>
      )}

      {/* AI refinement panel — natural-language summary of the current
          preview + 0-3 narrowing suggestions. Clicking a chip pre-fills the
          Refine prompt so the vendor can edit/submit. Self-hides without a
          query/preview, so it never shows in the empty state. */}
      <RefinementPanel
        query={debouncedQuery}
        count={preview?.count ?? null}
        baseCount={baseCount}
        locale={aiLocale}
        onPickSuggestion={(refinement) => {
          setPromptPrefill(refinement)
          // Reset the prefill on the next frame so re-clicking the same chip
          // still triggers the prefill prop-change handling in DescribePrompt.
          requestAnimationFrame(() => setPromptPrefill(""))
        }}
      />

      {/* Customers preview — reflects the last run (manual-run model). When
          the query is emptied the frame hides, so show the empty state here
          rather than stale matches from a previous run. */}
      <CustomersPreview
        sample={hasQuery ? (preview?.sample ?? []) : []}
        loading={hasQuery && previewLoading}
        empty={!hasQuery || (!previewLoading && (preview?.count ?? 0) === 0)}
      />

      {/* Hidden submit button so the form is submittable via Enter inside
          text inputs without exposing a visible Save button (the sticky
          unsaved bar provides the visible Save). */}
      <button type="submit" className={cn("hidden")} aria-hidden tabIndex={-1} />

      <SaveSegmentDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        initialName={nameValue}
        saving={creating}
        onSave={handleConfirmName}
      />

      <TemplatesPicker
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onApply={handleApplyTemplate}
        locale={aiLocale}
      />
    </form>
  )
}
