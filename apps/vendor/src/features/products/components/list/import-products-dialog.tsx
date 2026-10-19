"use client"

import { useRef, useState, type ReactNode } from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  AlertTriangleIcon,
  FileTextIcon,
  InfoIcon,
  Loader2Icon,
  PaperclipIcon,
  PlusIcon,
} from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
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
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import {
  CREATE_STORE_IMPORT,
  IMPORT_PRODUCTS_CSV,
  type CreateStoreImportData,
  type CsvImportResult,
  type CsvImportRow,
  type ImportProductsCsvData,
} from "@/features/products/api"
import {
  IMPORTABLE_PLATFORMS,
  storeImportErrorKey,
  type ImportablePlatform,
} from "@/features/products/lib/store-import"
import { formatMoneyCents } from "@/shared/lib/format"
import { useShopCurrency } from "@/shared/hooks/use-shop-currency"

const MAX_FILE_BYTES = 5 * 1024 * 1024

/** Which pane is on screen. `conflict` is skipped when the file has none. */
type Step = "source" | "url" | "file" | "conflict" | "preview"

/**
 * Where the products come from. `store` and `product` share the `url` step,
 * but not its copy: the one sentence nothing can check — the attestation —
 * says something different about a whole store than about one listing.
 */
type ImportSource = "csv" | "store" | "product"

/** The `url` step's messages, which exist once per scope under the same keys. */
type AddressCopyKey =
  | "title"
  | "description"
  | "urlLabel"
  | "urlPlaceholder"
  | "urlHelp"
  | "attest"
  | "attestHelp"
  | "attestRequired"
  | "submit"

interface ImportProductsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Product import: pick a source, then either attach a file or name a store.
 *
 * **Nothing is asked before it is known to matter.** Attaching the file runs
 * a dry run, and the answer decides the next screen: a file whose handles are
 * all new goes straight to the preview, and only a file that collides with
 * products the shop already sells is worth stopping for — that is the whole
 * reason the overwrite question exists, so it is asked *there*, naming the
 * products it is about, rather than as a checkbox on an empty form.
 *
 * The preview and the conflict check are both the **back-end's own dry run**,
 * not a second parser in the browser: the same mutation runs with the same
 * file, `dry_run: true`, and then once more to commit. A browser-side reading
 * would be a second implementation of the header mapping and the handle
 * grouping, and the two would drift — the merchant would approve one reading
 * of their file and get another.
 *
 * The file is read as text rather than uploaded as multipart because the
 * mutation takes the body inline; 5 MB is the ceiling, roughly a 20k-row
 * catalogue and well past the importer's own 5000-row cap.
 *
 * **The store branch ends here rather than continuing in the dialog.** A scan
 * crawls somebody's whole catalogue and runs for minutes, so the wizard's job
 * is finished the moment a job exists: it hands over to
 * `/products/import/[jobId]`, a URL the merchant can close the tab on and come
 * back to. A dialog holding a poll would lose the import to a stray Escape.
 *
 * **One product is its own source, not a smaller store.** Picking it opens the
 * same address step with a product URL, no platform picker and its own
 * attestation, and sends `scope: PRODUCT`: the server then reads that one page
 * and follows nothing from it, and books no store-import quota unit. The
 * attestation is still required — on somebody else's product page it is the
 * only thing between "import this" and copying their listing — so its wording
 * names the two answers that make it honest (my own listing, or the rights
 * holder's permission) and says what is not allowed. Switching source clears
 * the tick, because a box ticked under one sentence is not an answer to the
 * other.
 *
 * The chrome is three bands — a title-only header over a hairline, a padded
 * body, and the footer primitive's grey strip holding Cancel/Back and Next and
 * nothing else. The sample CSV lives inside the CSV option's helper sentence
 * (and again under the file step's drop zone), not in the footer: it belongs
 * to that one choice, and a footer link showed on the store-address step too,
 * where it answered a question nobody had asked.
 */
export function ImportProductsDialog({
  open,
  onOpenChange,
}: ImportProductsDialogProps) {
  const t = useTranslations("products.import")
  const router = useRouter()
  const params = useParams<{ shopSlug: string }>()
  const currency = useShopCurrency()
  const inputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>("source")
  const [source, setSource] = useState<ImportSource>("csv")
  const [file, setFile] = useState<File | null>(null)
  const [csv, setCsv] = useState<string>("")
  const [resolution, setResolution] = useState<"skip" | "overwrite">("skip")
  const [publishNew, setPublishNew] = useState(true)
  const [result, setResult] = useState<CsvImportResult | null>(null)

  const [sourceUrl, setSourceUrl] = useState("")
  const [platform, setPlatform] = useState<ImportablePlatform>("AUTO")
  const [attested, setAttested] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  const single = source === "product"
  /** The address step's copy for the scope on screen. */
  const addressCopy = (key: AddressCopyKey) =>
    t(`${single ? "product" : "url"}.${key}`)

  const [runImport, { loading }] = useMutation<ImportProductsCsvData>(
    IMPORT_PRODUCTS_CSV,
    { refetchQueries: "active" },
  )
  const [createStoreImport, { loading: scanning }] =
    useMutation<CreateStoreImportData>(CREATE_STORE_IMPORT, {
      refetchQueries: "active",
    })

  const reset = () => {
    setStep("source")
    setSource("csv")
    setFile(null)
    setCsv("")
    setResolution("skip")
    setPublishNew(true)
    setResult(null)
    setSourceUrl("")
    setPlatform("AUTO")
    setAttested(false)
    setUrlError(null)
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) reset()
  }

  const handleFile = async (picked: File | undefined) => {
    if (!picked) return
    if (picked.size > MAX_FILE_BYTES) {
      sileo.error({
        title: t("csv.tooLarge"),
        description: t("csv.tooLargeBody"),
      })
      return
    }
    // Always UTF-8: a Shopify export is UTF-8 and reading it as anything else
    // turns every accented character and smart quote into mojibake.
    setFile(picked)
    setCsv(await picked.text())
    setResult(null)
    setResolution("skip")
  }

  /** One call to the importer. `dryRun` decides whether it writes. */
  const run = async (dryRun: boolean, overwrite: boolean) => {
    const { data } = await runImport({
      variables: {
        input: {
          csv,
          dry_run: dryRun,
          overwrite_existing: overwrite,
          publish_new: publishNew,
        },
      },
    })
    return data?.importProductsCsv ?? null
  }

  const fail = (title: string, err: unknown) =>
    sileo.error({
      title,
      description: err instanceof Error ? err.message : t("csv.tryAgain"),
    })

  /** File step → the check that decides whether a conflict screen is needed. */
  const check = async () => {
    try {
      const checked = await run(true, false)
      if (!checked) return
      setResult(checked)
      setStep(conflictsIn(checked).length > 0 ? "conflict" : "preview")
    } catch (err) {
      fail(t("csv.readFailed"), err)
    }
  }

  /** Conflict step → re-read the file under the answer the merchant gave. */
  const applyResolution = async () => {
    if (resolution === "skip") {
      setStep("preview")
      return
    }
    try {
      // The counts change with the answer — what was "3 skipped" becomes
      // "3 updated" — so the preview has to be the report for the run that
      // will actually happen, not the one that asked the question.
      const rerun = await run(true, true)
      if (!rerun) return
      setResult(rerun)
      setStep("preview")
    } catch (err) {
      fail(t("csv.readFailed"), err)
    }
  }

  const commit = async () => {
    try {
      const done = await run(false, resolution === "overwrite")
      if (!done) return
      sileo.success({
        title: t("csv.finished"),
        description: t("csv.finishedBody", {
          created: done.created,
          updated: done.updated,
          skipped: done.skipped,
        }),
      })
      handleOpenChange(false)
    } catch (err) {
      fail(t("csv.failed"), err)
    }
  }

  /**
   * Open the migration.
   *
   * The attestation is checked here and not only by a disabled button: the
   * back-end refuses an unattested request before it will even parse the URL,
   * so this says *why* rather than leaving a button that cannot be pressed and
   * does not explain itself.
   */
  const startScan = async () => {
    const url = normalizeSourceUrl(sourceUrl)
    if (!url) {
      setUrlError(t("errors.urlBlocked"))
      return
    }
    // A home page is a whole store, not a product: read as PRODUCT it would
    // import whichever item the front page happens to feature.
    if (single && isSiteRoot(url)) {
      setUrlError(t("product.urlIsHome"))
      return
    }
    if (!attested) {
      setUrlError(addressCopy("attestRequired"))
      return
    }
    setUrlError(null)
    try {
      const { data } = await createStoreImport({
        variables: {
          input: {
            source_url: url,
            // The picker is not on screen for a product, so a choice left
            // over from the store branch must not ride along unseen.
            requested_platform: single ? "AUTO" : platform,
            attested_owner: true,
            // Only for a product. Absent is STORE on the server, so a
            // whole-store request stays valid against an API that predates
            // the field.
            ...(single && { scope: "PRODUCT" as const }),
          },
        },
      })
      const job = data?.createStoreImport?.data
      if (!job) return
      handleOpenChange(false)
      router.push(`/store/${params?.shopSlug ?? ""}/products/import/${job.id}`)
    } catch (err) {
      const key = storeImportErrorKey(err)
      if (key === "ownershipNotAttested") {
        setUrlError(addressCopy("attestRequired"))
        return
      }
      setUrlError(key ? t(`errors.${key}`) : t("errors.generic"))
    }
  }

  const conflicts = result ? conflictsIn(result) : []
  const invalid = result ? invalidIn(result) : []

  const back = () => {
    if (step === "source") return handleOpenChange(false)
    if (step === "url") return setStep("source")
    if (step === "file") return setStep("source")
    if (step === "conflict") return setStep("file")
    setStep(conflicts.length > 0 ? "conflict" : "file")
  }

  const next = () => {
    if (step === "source") return setStep(source === "csv" ? "file" : "url")
    if (step === "url") return void startScan()
    if (step === "file") return void check()
    if (step === "conflict") return void applyResolution()
    void commit()
  }

  const busy = loading || scanning
  const nextDisabled =
    busy ||
    (step === "url" ? !sourceUrl.trim() : step === "source" ? false : !csv)

  const nextLabel: Record<Step, string> = {
    source: t("next"),
    url: scanning ? t("url.submitting") : addressCopy("submit"),
    file: t("csv.upload"),
    conflict: t("csv.continue"),
    preview: t("csv.import"),
  }

  const title =
    step === "source"
      ? t("title")
      : step === "url"
        ? addressCopy("title")
        : step === "file"
          ? t("csv.title")
          : step === "conflict"
            ? t("csv.conflictTitle")
            : t("csv.previewTitle")

  const description =
    step === "source"
      ? t("source.description")
      : step === "url"
        ? addressCopy("description")
        : step === "file"
          ? t("csv.description")
          : step === "conflict"
            ? t("csv.conflictDescription", {
                conflicts: conflicts.length,
                total: result?.products ?? 0,
              })
            : t("csv.previewDescription")

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-3xl" closeLabel={t("close")}>
        {/* `pe-12` keeps the title clear of the built-in X, which sits at the
            end edge — the left one under RTL. */}
        <DialogHeader className="border-b border-border px-5 py-3.5 pe-12">
          <DialogTitle className="font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-5 py-5">
          {/* Still the dialog's description (Base UI wires `aria-describedby`
              through context, so it need not sit in the header), but on the
              source step it is the question the two radios answer, and a
              question is body text rather than fine print. */}
          <DialogDescription
            id="import-step-description"
            className={step === "source" ? "text-foreground" : undefined}
          >
            {description}
          </DialogDescription>

          {step === "source" && (
            <RadioGroup
              aria-labelledby="import-step-description"
              value={source}
              onValueChange={(value) => {
                const next = value as ImportSource
                if (next === source) return
                setSource(next)
                // The tick answered the other source's sentence, not this one.
                setAttested(false)
                setUrlError(null)
              }}
              className="gap-5"
            >
              <RadioRow
                name="import-source"
                value="csv"
                label={t("source.csv")}
                helper={t.rich("source.csvHelp", { sample: sampleLink })}
              />
              <RadioRow
                name="import-source"
                value="store"
                label={t("source.store")}
                helper={t("source.storeHelp")}
              />
              <RadioRow
                name="import-source"
                value="product"
                label={t("source.product")}
                helper={t("source.productHelp")}
              />
            </RadioGroup>
          )}

          {step === "url" && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="store-import-url">
                  {addressCopy("urlLabel")}
                </Label>
                <Input
                  id="store-import-url"
                  type="url"
                  inputMode="url"
                  dir="ltr"
                  placeholder={addressCopy("urlPlaceholder")}
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {addressCopy("urlHelp")}
                </p>
              </div>

              {/* Not offered for one product, as Sidekick's `import_product`
                does not offer it either: detection reads one page, and a
                picker here would be a second question about a single item. */}
              {!single && (
                <div className="grid gap-2">
                  <Label htmlFor="store-import-platform">
                    {t("url.platformLabel")}
                  </Label>
                  <Select
                    value={platform}
                    onValueChange={(value) =>
                      setPlatform(value as ImportablePlatform)
                    }
                  >
                    <SelectTrigger
                      id="store-import-platform"
                      className="h-9 w-full"
                    >
                      <SelectValue>
                        {(value: ImportablePlatform | null) =>
                          t(platformKey(value ?? "AUTO"))
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} sideOffset={6}>
                      {IMPORTABLE_PLATFORMS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(platformKey(value))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t("url.platformHelp")}
                  </p>
                </div>
              )}

              {/* Required, and the one thing on this form no code can check. The
                back-end refuses an unattested request before it resolves the
                hostname, so the box is the whole basis of the answer to "who
                said you could copy this store?" — together with the audit row
                it writes, which records the scope beside it. */}
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
                <Checkbox
                  id="store-import-attest"
                  // The help says what is not allowed, so a screen reader
                  // hears it with the box rather than only when it wanders by.
                  aria-describedby="store-import-attest-help"
                  checked={attested}
                  onCheckedChange={(checked) => {
                    setAttested(checked === true)
                    if (checked === true) setUrlError(null)
                  }}
                />
                <div className="grid gap-1">
                  <Label
                    htmlFor="store-import-attest"
                    className="text-sm font-normal leading-snug"
                  >
                    {addressCopy("attest")}
                  </Label>
                  <p
                    id="store-import-attest-help"
                    className="text-xs text-muted-foreground"
                  >
                    {addressCopy("attestHelp")}
                  </p>
                </div>
              </div>

              {urlError && (
                <p role="alert" className="text-sm text-destructive">
                  {urlError}
                </p>
              )}
            </div>
          )}

          {step === "file" && (
            <div className="flex flex-col gap-4">
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />

              {file ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                  <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {file.name}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                  >
                    {t("csv.replaceFile")}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-12 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  {/* The outline button's face, by hand: it cannot be a real
                    `Button` inside the zone's own `<button>`, and the page
                    ground (`bg-background`) read as a disabled chip on the
                    white popup. */}
                  <span className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium dark:border-input">
                    <PlusIcon className="size-4" />
                    {t("csv.addFile")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("csv.addFileHint")}
                  </span>
                </button>
              )}

              {/* Outside the zone's `<button>` on purpose: a link inside a
                button is unreachable by keyboard. This is where a merchant
                finds out they have no file yet. */}
              <p className="text-sm text-muted-foreground">
                {t.rich("source.csvHelp", { sample: sampleLink })}
              </p>
            </div>
          )}

          {step === "conflict" && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p id="import-conflict-heading" className="font-medium">
                    {t("csv.conflictHeading", { count: conflicts.length })}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {conflicts.slice(0, 6).map((row) => (
                      <li key={row.row_number}>
                        {row.slug ?? t("csv.row", { row: row.row_number })}
                      </li>
                    ))}
                    {conflicts.length > 6 && (
                      <li>
                        {t("csv.andMore", { count: conflicts.length - 6 })}
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Named after the amber heading rather than the description: the
                heading is the sentence skip/overwrite answers. */}
              <RadioGroup
                aria-labelledby="import-conflict-heading"
                value={resolution}
                onValueChange={(value) =>
                  setResolution(value as "skip" | "overwrite")
                }
                className="gap-5"
              >
                <RadioRow
                  name="import-conflict"
                  value="skip"
                  label={t("csv.skip")}
                  helper={t("csv.skipHelp")}
                />
                <RadioRow
                  name="import-conflict"
                  value="overwrite"
                  label={t("csv.overwrite")}
                  helper={t("csv.overwriteHelp")}
                />
              </RadioGroup>
            </div>
          )}

          {step === "preview" && result && (
            <ImportPreview
              result={result}
              currency={currency}
              invalid={invalid}
              publishNew={publishNew}
              onPublishNewChange={setPublishNew}
            />
          )}
        </div>

        {/* The primitive's own strip (hairline, grey ground, end-aligned,
            stacked on phones); `mx-0 mb-0` undo the bleed it applies for a
            padded content box, since this one is `p-0`. The two buttons are
            its direct children so the phone stacking still works. */}
        <DialogFooter className="mx-0 mb-0 px-5 py-4">
          <Button variant="outline" size="sm" onClick={back}>
            {step === "source" ? t("cancel") : t("back")}
          </Button>
          <Button
            size="sm"
            disabled={nextDisabled}
            aria-busy={busy || undefined}
            onClick={next}
          >
            {busy && <Loader2Icon className="animate-spin" />}
            {nextLabel[step]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The message key for one platform, kept beside the enum it mirrors. */
function platformKey(platform: ImportablePlatform): string {
  return `url.platform${platform.charAt(0)}${platform.slice(1).toLowerCase()}`
}

/**
 * The `<sample>` tag in `source.csvHelp`: the sample file, as a link inside
 * the sentence that explains what a CSV here is. Module-level and hook-free,
 * so `t.rich` can take it on every render. It inherits the helper's muted
 * colour and steps up to the foreground on hover, the same convention
 * `DialogDescription` applies to an anchor of its own.
 */
const sampleLink = (chunks: ReactNode) => (
  <a
    href="/sample-products.csv"
    download
    className="rounded-xs underline underline-offset-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
  >
    {chunks}
  </a>
)

/**
 * What the merchant typed, as a URL the back-end will accept.
 *
 * A bare `old-store.com` is the ordinary way a person names their own shop,
 * and `IsUrl({ require_protocol: true })` rejects it — so the scheme is added
 * rather than the merchant being told their own address is invalid. Nothing
 * else is guessed: an unparseable string comes back null and the form says so,
 * because the SSRF guard is the one that decides what is reachable and a
 * second opinion here would mean two answers to one question.
 */
function normalizeSourceUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    return url.hostname.includes(".") ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * A site's front door rather than a page on it: no path and no query.
 *
 * A query counts as a page because a WooCommerce store without pretty
 * permalinks names its products `/?product=blue-mug`.
 */
function isSiteRoot(url: string): boolean {
  const parsed = new URL(url)
  return parsed.pathname === "/" && !parsed.search
}

/**
 * Products the importer refused because their handle is already taken.
 *
 * The `product_id` is what separates them from a row skipped for being
 * invalid: the importer sets it only when it matched an existing product, so
 * a title-less row and a colliding handle never end up in the same list.
 */
function conflictsIn(result: CsvImportResult): CsvImportRow[] {
  return result.rows.filter((row) => row.action === "skip" && !!row.product_id)
}

/** Products the importer refused because the file's own data is wrong. */
function invalidIn(result: CsvImportResult): CsvImportRow[] {
  return result.rows.filter((row) => row.action === "skip" && !row.product_id)
}

/**
 * A radio with its explanation underneath. The coupons form has a `RadioRow`
 * of its own; this one stayed local because both of this dialog's radio groups
 * read as a choice plus a sentence, and the coupons one carries neither.
 *
 * The helper is a sibling of the label rather than a span inside it, for two
 * reasons that pull the same way. `Label` is a flex row, so a span inside it
 * sat beside the label text until it ran out of width instead of under it.
 * And the CSV helper carries a link: inside a `<label>` every click on the
 * link would also activate the radio, and its text would become part of the
 * radio's accessible name. So the helper describes the radio
 * (`aria-describedby`) instead of naming it.
 */
function RadioRow({
  name,
  value,
  label,
  helper,
}: {
  name: string
  value: string
  label: string
  helper: ReactNode
}) {
  const id = `${name}-${value}`
  const helpId = `${id}-help`
  return (
    <div className="flex items-start gap-3">
      <RadioGroupItem
        id={id}
        value={value}
        aria-describedby={helpId}
        className="mt-0.5"
      />
      <div className="grid gap-1">
        <Label htmlFor={id} className="text-sm font-normal leading-snug">
          {label}
        </Label>
        <p id={helpId} className="text-sm leading-snug text-muted-foreground">
          {helper}
        </p>
      </div>
    </div>
  )
}

/** The dry run's report: what the file adds up to, then the first product. */
function ImportPreview({
  result,
  currency,
  invalid,
  publishNew,
  onPublishNewChange,
}: {
  result: CsvImportResult
  currency: string
  invalid: CsvImportRow[]
  publishNew: boolean
  onPublishNewChange: (next: boolean) => void
}) {
  const t = useTranslations("products.import")
  const preview = result.preview

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
      <div className="flex gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p>
          {/* `t.rich` rather than a plain `t`: the three figures a merchant
              actually checks were bold before this string was translated, and
              a sentence of undifferentiated numbers is the one place that
              costs something. */}
          {t.rich("csv.summary", {
            products: result.products,
            skus: result.skus,
            images: result.images,
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            b: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </div>

      {invalid.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="font-medium">
              {t("csv.invalidHeading", { count: invalid.length })}
            </p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {invalid.slice(0, 5).map((row) => (
                <li key={row.row_number}>
                  {row.slug
                    ? t("csv.invalidRowNamed", {
                        row: row.row_number,
                        slug: row.slug,
                        message:
                          row.errors?.[0]?.message ?? t("csv.rowSkipped"),
                      })
                    : t("csv.invalidRow", {
                        row: row.row_number,
                        message:
                          row.errors?.[0]?.message ?? t("csv.rowSkipped"),
                      })}
                </li>
              ))}
              {invalid.length > 5 && (
                <li>{t("csv.andMore", { count: invalid.length - 5 })}</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {result.unmapped_headers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("csv.unmapped", { columns: result.unmapped_headers.join(", ") })}
        </p>
      )}

      {preview && (
        <>
          <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            <PreviewField label={t("csv.fieldTitle")} value={preview.title} />
            <PreviewField
              label={t("csv.fieldDescription")}
              value={preview.description}
            />
            <PreviewField label={t("csv.fieldStatus")} value={preview.status} />
            <PreviewField
              label={t("csv.fieldKind")}
              value={preview.product_type}
            />
            <PreviewField
              label={t("csv.fieldCategory")}
              value={preview.category}
            />
            <PreviewField label={t("csv.fieldVendor")} value={preview.brand} />
          </dl>

          {preview.variants.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-start font-medium">
                      {t("csv.variant")}
                    </th>
                    <th className="px-4 py-2 text-start font-medium">
                      {t("csv.sku")}
                    </th>
                    <th className="px-4 py-2 text-start font-medium">
                      {t("csv.weight")}
                    </th>
                    <th className="px-4 py-2 text-end font-medium">
                      {t("csv.price")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.variants.slice(0, 8).map((variant) => (
                    <tr key={`${variant.title}-${variant.sku ?? ""}`}>
                      <td className="px-4 py-2">{variant.title}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {variant.sku ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {variant.weight_grams != null
                          ? `${variant.weight_grams} g`
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-end">
                        {formatMoneyCents(variant.price_cents, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.variants.length > 8 && (
                <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                  {t("csv.moreVariants", {
                    count: preview.variants.length - 8,
                  })}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {!preview && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileTextIcon className="size-4" />
          {t("csv.nothingReadable")}
        </p>
      )}

      {/* Asked here rather than earlier because it is a decision about the
          products this import creates, and this is the screen that says how
          many that is. A file that creates none never asks. */}
      {result.created > 0 && (
        <div className="flex items-start gap-3 border-t border-border pt-4">
          <Checkbox
            id="csv-publish"
            checked={publishNew}
            onCheckedChange={(checked) => onPublishNewChange(checked === true)}
          />
          <div className="grid gap-1">
            <Label htmlFor="csv-publish" className="text-sm font-normal">
              {t("csv.publishNew", { count: result.created })}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("csv.publishNewHelp")}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function PreviewField({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  if (!value) return null
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="text-sm text-muted-foreground">{value}</dd>
    </div>
  )
}
