"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Controller, useWatch } from "react-hook-form";
import { useQuery } from "@apollo/client/react";
import {
  AlertTriangleIcon,
  CheckIcon,
  DatabaseIcon,
  Link2Icon,
  PlusIcon,
  RefreshCwIcon,
  SparklesIcon,
  Unlink2Icon,
  XIcon,
} from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@/shared/lib/utils";
import { translatable } from "@/shared/lib/format";
import { GET_CATEGORY_ATTRIBUTES, GET_SYSTEM_CATEGORIES_FLAT } from "@/features/products/api"
import type { AttributeDefinition, AttributeOption, CategoryAttributesResponse, SystemCategoriesFlatResponse } from "@/features/products/types"
import type {
  AttributeValueEntryInput,
  ProductFormApi,
} from "@/features/products/validations/product";
import { ConstrainedValuesInput } from "../variants/constrained-values-input";
import type { VariantOptionsApi } from "../variants/use-variant-options";
import type { AttributeSnapshot } from "@/features/products/lib/form/from-product-entry";
import {
  CATEGORY_METAFIELDS_DOM_ID,
  isValueFilled,
  metafieldRowDomId,
  suggestionPreview,
} from "@/features/products/lib/form/attribute-values";
import {
  useAttributeSuggestions,
  type AttributeSuggestionsApi,
} from "./use-attribute-suggestions";

interface AttributeValuesCardProps {
  form: ProductFormApi;
  /** Shared variants hook — lets SELECT/MULTI_SELECT rows promote to an axis. */
  variants: VariantOptionsApi;
  /** Outdated flags + resolved display labels from the initial product load. */
  snapshots?: Record<string, AttributeSnapshot>;
  /** Locale used for attribute definition labels. Defaults to English. */
  locale?: string;
}

/**
 * Category metafields (PRODUCTS.md §16.4) — Shopify-style UX.
 *
 * Each definition starts collapsed as a `+ Name` chip. Clicking promotes
 * it to an opened horizontal row (label left, input right). Required
 * fields and fields that already have a value are opened automatically.
 * Optional empty rows can be collapsed back to a chip via the row's `×`.
 *
 * Stale keys are pruned from the form state whenever the schema changes
 * so a category switch can't ship `ATTRIBUTE_UNKNOWN_KEY` to the server.
 */
export function AttributeValuesCard({
  form,
  variants,
  snapshots,
  locale = "en",
}: AttributeValuesCardProps) {
  // `products.categoryMetafields` predates this card by a long way and had no
  // consumer until now; the rest of the copy lives one level down, under
  // `products.metafields`.
  const tProducts = useTranslations("products");
  const t = useTranslations("products.metafields");

  const systemCategoryId = useWatch({
    control: form.control,
    name: "system_category_id",
  }) as string | undefined;

  const hasCategory = !!systemCategoryId?.trim();

  const { data: schemaData, loading: schemaLoading } =
    useQuery<CategoryAttributesResponse>(GET_CATEGORY_ATTRIBUTES, {
      variables: { systemCategoryId, locale },
      skip: !hasCategory,
      fetchPolicy: "cache-first",
    });

  const { data: flatData } = useQuery<SystemCategoriesFlatResponse>(
    GET_SYSTEM_CATEGORIES_FLAT,
    {
      variables: { locale },
      skip: !hasCategory,
      fetchPolicy: "cache-first",
    },
  );

  const definitions = useMemo(() => {
    const list = schemaData?.categoryAttributes?.data ?? [];
    return [...list].sort(
      (a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key),
    );
  }, [schemaData]);

  // Reactive snapshot of the live form values so chips/rows flip as the
  // user types — `useWatch` runs before `form.getValues()` would for
  // derived UI state.
  const values = useWatch({
    control: form.control,
    name: "attribute_values",
  }) as Record<string, AttributeValueEntryInput> | undefined;

  // Drop orphan keys on schema load / category change. Values whose
  // definition still exists are preserved.
  useEffect(() => {
    if (!hasCategory) {
      const current =
        (form.getValues("attribute_values") as
          | Record<string, AttributeValueEntryInput>
          | undefined) ?? {};
      if (Object.keys(current).length > 0) {
        form.setValue("attribute_values", {}, { shouldDirty: true });
      }
      return;
    }
    if (!definitions.length) return;
    const allowed = new Set(definitions.map((d) => d.key));
    const current =
      (form.getValues("attribute_values") as
        | Record<string, AttributeValueEntryInput>
        | undefined) ?? {};
    const pruned: Record<string, AttributeValueEntryInput> = {};
    let changed = false;
    for (const [key, value] of Object.entries(current)) {
      if (allowed.has(key)) pruned[key] = value;
      else changed = true;
    }
    if (changed) {
      form.setValue("attribute_values", pruned, { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCategory, definitions.map((d) => d.key).join("|")]);

  // Track which empty optional fields the user has chosen to open. The
  // set is reset on category change so we don't keep stale entries.
  const [manuallyOpened, setManuallyOpened] = useState<Set<string>>(new Set());
  // Reset on category change, adjusted during render rather than from an
  // effect: React discards this render and re-runs with the empty set, where
  // an effect would first commit a frame showing the previous category's
  // fields expanded.
  const [openedFor, setOpenedFor] = useState(systemCategoryId);
  if (openedFor !== systemCategoryId) {
    setOpenedFor(systemCategoryId);
    setManuallyOpened(new Set());
  }

  const openField = useCallback((key: string) => {
    setManuallyOpened((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const closeField = useCallback(
    (key: string) => {
      setManuallyOpened((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      // Drop the entry so the chip reverts cleanly to its empty state.
      const current =
        (form.getValues("attribute_values") as
          | Record<string, AttributeValueEntryInput>
          | undefined) ?? {};
      if (key in current) {
        const next = { ...current };
        delete next[key];
        form.setValue("attribute_values", next, { shouldDirty: true });
      }
    },
    [form],
  );

  const { opened, chips } = useMemo(() => {
    const opened: AttributeDefinition[] = [];
    const chips: AttributeDefinition[] = [];
    for (const def of definitions) {
      const filled = isValueFilled(def, values?.[def.key]);
      if (def.required || filled || manuallyOpened.has(def.key)) {
        opened.push(def);
      } else {
        chips.push(def);
      }
    }
    return { opened, chips };
  }, [definitions, values, manuallyOpened]);

  const suggestions = useAttributeSuggestions({
    form,
    definitions,
    values,
    systemCategoryId,
    locale,
    // Nothing to suggest against until the schema has loaded.
    enabled: hasCategory && definitions.length > 0,
  });

  const breadcrumb = useMemo(() => {
    if (!hasCategory || !systemCategoryId) return null;
    const flat = flatData?.systemCategoriesFlat?.data ?? [];
    const node = flat.find((n) => n.id === systemCategoryId);
    if (!node) return null;
    const parent = node.parent_id
      ? flat.find((n) => n.id === node.parent_id)
      : null;
    return { leaf: node.name, parent: parent?.name ?? null };
  }, [flatData, hasCategory, systemCategoryId]);

  if (!hasCategory) return null;

  return (
    <Card id={CATEGORY_METAFIELDS_DOM_ID} className="scroll-mt-24">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="text-base">
          {tProducts("categoryMetafields")}
        </CardTitle>
        {breadcrumb && (
          <Badge
            variant="outline"
            className="gap-1 bg-muted font-normal text-foreground"
          >
            <span className="font-medium">{breadcrumb.leaf}</span>
            {breadcrumb.parent && (
              <>
                <span className="text-muted-foreground">{t("in")}</span>
                <span>{breadcrumb.parent}</span>
              </>
            )}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {schemaLoading ? (
          <AttributesSkeleton />
        ) : definitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("none")}</p>
        ) : (
          <>
            <SuggestionBanner
              suggestions={suggestions}
              definitions={definitions}
            />

            {opened.length > 0 && (
              <div className="flex flex-col divide-y divide-border">
                {opened.map((def) => (
                  <AttributeRow
                    key={def.key}
                    form={form}
                    variants={variants}
                    def={def}
                    value={values?.[def.key]}
                    snapshot={snapshots?.[def.key]}
                    locale={locale}
                    canClose={
                      !def.required && !isValueFilled(def, values?.[def.key])
                    }
                    onClose={() => closeField(def.key)}
                  />
                ))}
              </div>
            )}

            {chips.length > 0 && (
              <div
                className={cn(
                  "flex flex-wrap gap-2",
                  opened.length > 0 && "border-t border-border pt-4",
                )}
              >
                {chips.map((def) => (
                  <AttributeChip
                    key={def.key}
                    label={translatable(def.name) || def.key}
                    onClick={() => openField(def.key)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── AI suggestions ──────────────────────────────────────────────────

/**
 * The "N suggestions available / Accept all" block, over the fields it is
 * about.
 *
 * The proposed values are shown **here** rather than tinted into the real
 * inputs, which is the one place this departs from the screen it is modelled
 * on. Painting a value into a field the merchant has not accepted makes the
 * form lie about its own state: the input reads "Spray", the form value is
 * empty, and whether Save writes it depends on a rule nobody can see. Keeping
 * the proposals in their own block means the form always shows what will be
 * saved, and accepting is the one thing that changes it.
 *
 * Renders nothing at all in the ordinary case — no category yet, nothing to
 * fill, an unconfigured provider, a model with nothing confident to say. A
 * failed suggestion is not something to interrupt a product form with; the
 * only failure it does mention is one the merchant asked for by retrying.
 *
 * Exported for its own render test: the card around it needs Apollo, a
 * react-hook-form instance and a category before it will draw anything, and
 * none of that has a bearing on the four states this block has.
 */
export function SuggestionBanner({
  suggestions,
  definitions,
}: {
  suggestions: AttributeSuggestionsApi;
  definitions: AttributeDefinition[];
}) {
  const t = useTranslations("products.metafields.suggestions");
  const tMetafields = useTranslations("products.metafields");
  const { status, pending } = suggestions;
  const booleanLabel = (value: boolean) =>
    value ? tMetafields("booleanYes") : tMetafields("booleanNo");

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
        <SparklesIcon className="size-4 animate-pulse" />
        {t("looking")}
      </div>
    );
  }

  // "The provider fell over" is worth a retry; "it read the product and had
  // nothing to add" is worth nothing at all. `generated` is the only thing
  // that tells those apart, which is why the response carries it.
  // Platform budget / rate-limit refusals are a third case: retrying cannot
  // help until the cap resets, so the banner names that and offers no button.
  if (status === "quota") {
    return (
      <div className="rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
        {t("quotaExhausted")}
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2.5">
        <span className="text-sm text-muted-foreground">
          {t("unavailable")}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={suggestions.retry}
        >
          <RefreshCwIcon className="size-3.5" />
          {t("tryAgain")}
        </Button>
      </div>
    );
  }

  if (pending.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-primary/30 bg-primary/[0.04]">
      <div className="flex items-center justify-between gap-3 border-b border-primary/20 px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <SparklesIcon className="size-4 text-primary" />
          {t("available", { count: pending.length })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={suggestions.acceptAll}
          >
            {t("acceptAll")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("dismissAll")}
            onClick={suggestions.dismissAll}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-primary/15">
        {pending.map((suggestion) => {
          const def = definitions.find((d) => d.key === suggestion.key);
          if (!def) return null;
          const preview = suggestionPreview(
            def,
            suggestion,
            translatable,
            booleanLabel,
          );
          return (
            <div
              key={suggestion.key}
              className="grid grid-cols-[minmax(0,200px)_1fr_auto] items-center gap-3 px-3 py-2"
            >
              <span className="truncate text-sm text-muted-foreground">
                {translatable(def.name) || def.key}
              </span>
              <span className="truncate text-sm font-medium text-foreground">
                {preview}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => suggestions.accept(suggestion.key)}
                >
                  <CheckIcon className="size-3.5" />
                  {t("accept")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("dismiss", {
                    name: translatable(def.name) || def.key,
                  })}
                  onClick={() => suggestions.dismiss(suggestion.key)}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Opened row ──────────────────────────────────────────────────────

interface AttributeRowProps {
  form: ProductFormApi;
  variants: VariantOptionsApi;
  def: AttributeDefinition;
  value: AttributeValueEntryInput | undefined;
  snapshot?: AttributeSnapshot;
  locale: string;
  canClose: boolean;
  onClose: () => void;
}

function AttributeRow({
  form,
  variants,
  def,
  value,
  snapshot,
  locale,
  onClose,
}: AttributeRowProps) {
  const t = useTranslations("products.metafields");
  const tCommon = useTranslations("common");
  const label = translatable(def.name) || def.key;
  const errorsMap = form.formState.errors?.attribute_values as
    | Record<string, { message?: string } | undefined>
    | undefined;
  const error = errorsMap?.[def.key]?.message;

  // Connect works for any metafield type now — the axis carries an
  // options list for SELECT/MULTI_SELECT (constrained picker) and stays
  // free-text for TEXT/NUMBER/BOOLEAN (plain chip input).
  const connected = variants.isAttributeConnected(def.key);

  // "Clear" wipes the value and — for optional fields — collapses the
  // row back to a chip. Matches the Shopify "Clear" affordance the user
  // shared. Required rows stay open even after clearing (the user then
  // has to re-fill to pass form validation).
  const clearable = !def.required || isValueFilled(def, value);

  return (
    <div
      id={metafieldRowDomId(def.key)}
      className="grid scroll-mt-24 grid-cols-[minmax(0,200px)_1fr] items-start gap-4 py-3 first:pt-1 last:pb-1"
    >
      <div className="flex min-w-0 flex-col gap-0.5 pt-2">
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{label}</span>
          {def.required && (
            <span aria-label={t("required")} className="text-destructive">
              *
            </span>
          )}
          <DatabaseIcon
            className="size-3.5 text-muted-foreground"
            aria-hidden
          />
        </label>
        <span className="text-xs text-muted-foreground">
          {typeSubtitle(def, t)}
        </span>
        {snapshot?.is_outdated && (
          <Badge
            variant="outline"
            className="mt-1 w-fit gap-1 border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-medium text-amber-900"
          >
            <AlertTriangleIcon className="size-3" />
            {t("outdated")}
          </Badge>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex-1 min-w-0">
            {connected ? (
              // Once linked to a variant axis, the values live there —
              // the metafield becomes read-only so editing can't happen
              // in two places at once. The user must `Disconnect` (from
              // the axis badge) or edit through the Variants section.
              <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {t("managedByVariants")}
              </div>
            ) : (
              <AttributeControl form={form} def={def} locale={locale} />
            )}
          </div>

          {clearable && (
            <button
              type="button"
              onClick={onClose}
              className="mt-2 shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {tCommon("clear")}
            </button>
          )}
        </div>

        {!connected && (
          <ConnectToOptionControl
            def={def}
            value={value}
            connected={connected}
            onConnect={(values) =>
              variants.connectAttribute(
                def.key,
                translatable(def.name) || def.key,
                values,
                def.options.map((opt) => ({
                  value: opt.value,
                  label: optionLabel(opt, locale),
                })),
              )
            }
            onDisconnect={() => variants.disconnectAttribute(def.key)}
          />
        )}

        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : def.description && translatable(def.description) ? (
          <p className="text-xs text-muted-foreground">
            {translatable(def.description)}
          </p>
        ) : null}
      </div>
    </div>
  );

}

/**
 * Human-readable subtitle shown under the metafield name. Matches the
 * Shopify "Metaobject (List)" affordance — signals to the vendor how
 * many values they can enter and what shape the field takes.
 */
function typeSubtitle(
  def: AttributeDefinition,
  // Passed in rather than looked up: this is a module-level helper, and a hook
  // called from here would be a hook called outside a component.
  t: ReturnType<typeof useTranslations>,
): string {
  switch (def.type) {
    case "TEXT":
      return t("types.TEXT");
    case "NUMBER":
      return def.unit
        ? t("types.NUMBER_UNIT", { unit: def.unit })
        : t("types.NUMBER");
    case "BOOLEAN":
      return t("types.BOOLEAN");
    case "SELECT":
      return t("types.SELECT");
    case "MULTI_SELECT":
      return t("types.MULTI_SELECT");
    default:
      // An attribute type the client does not know yet: the raw enum is more
      // use to whoever has to report it than a translated guess would be.
      return String(def.type);
  }
}

/**
 * Link a SELECT / MULTI_SELECT metafield to a variant axis. Any values
 * the user has already picked in the metafield are pre-filled as chips
 * on the axis; if nothing is picked yet, the axis still opens (empty)
 * so the user can assemble the option set from inside the Variants
 * section directly.
 */
function ConnectToOptionControl({
  def,
  value,
  connected,
  onConnect,
  onDisconnect,
}: {
  def: AttributeDefinition;
  value: AttributeValueEntryInput | undefined;
  connected: boolean;
  onConnect: (values: string[]) => void;
  onDisconnect: () => void;
}) {
  // `products.connectToOption` is the shared key the sidebar copy already had;
  // the disconnect side is longer than the bare `products.disconnect` the
  // variants axis badge uses, so it gets its own.
  const tProducts = useTranslations("products");
  const t = useTranslations("products.metafields");
  const booleanYes = t("booleanYes");
  const booleanNo = t("booleanNo");

  const pickedValues = useMemo(() => {
    let picked: string[] = [];
    switch (def.type) {
      case "SELECT":
        picked = value?.option ? [value.option] : [];
        break;
      case "MULTI_SELECT":
        picked = value?.options ?? [];
        break;
      case "TEXT":
        picked = value?.text?.trim() ? [value.text.trim()] : [];
        break;
      case "NUMBER":
        picked =
          typeof value?.number === "number" && !Number.isNaN(value.number)
            ? [String(value.number)]
            : [];
        break;
      case "BOOLEAN":
        // A two-value axis only makes sense if the user has set the
        // flag explicitly — skip the pre-fill otherwise. The chip is the
        // merchant's own option value, so it is written in their language.
        picked =
          typeof value?.boolean === "boolean"
            ? [value.boolean ? booleanYes : booleanNo]
            : [];
        break;
    }
    return Array.from(new Set(picked.map((v) => v.trim()).filter(Boolean)));
  }, [def.type, value, booleanYes, booleanNo]);

  if (connected) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={onDisconnect}
      >
        <Unlink2Icon className="size-3.5" />
        {t("disconnectFromVariants")}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
      onClick={() => onConnect(pickedValues)}
    >
      <Link2Icon className="size-3.5" />
      {tProducts("connectToOption")}
    </Button>
  );
}

// ── Closed chip ─────────────────────────────────────────────────────

function AttributeChip({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted/70"
    >
      <PlusIcon className="size-3.5" />
      {label}
    </button>
  );
}

// ── Dynamic control per attribute type ──────────────────────────────

function AttributeControl({
  form,
  def,
  locale,
}: {
  form: ProductFormApi;
  def: AttributeDefinition;
  locale: string;
}) {
  const t = useTranslations("products.metafields");
  // Whole string in, no `.toLowerCase()`: casing a translated noun means
  // nothing in Arabic, and "Add" is not a prefix in every language either.
  const addValue = t("addValue", { name: translatable(def.name) || def.key });
  const baseName = `attribute_values.${def.key}` as const;

  switch (def.type) {
    case "TEXT":
      return (
        <Input
          placeholder={addValue}
          {...form.register(`${baseName}.text` as const)}
        />
      );

    case "NUMBER":
      return (
        <div className="relative">
          <Input
            type="number"
            step={1}
            placeholder="0"
            className={def.unit ? "pr-14" : undefined}
            {...form.register(`${baseName}.number` as const)}
          />
          {def.unit && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
              {def.unit}
            </span>
          )}
        </div>
      );

    case "BOOLEAN":
      return (
        <Controller
          control={form.control}
          name={`${baseName}.boolean` as const}
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!field.value}
                onCheckedChange={(v) => field.onChange(!!v)}
              />
              {t("enabled")}
            </label>
          )}
        />
      );

    case "SELECT":
      return (
        <Controller
          control={form.control}
          name={`${baseName}.option` as const}
          render={({ field }) => {
            // Base UI Select flips from uncontrolled → controlled if the
            // initial value is `undefined`. Always feed a string so the
            // component stays controlled across its lifetime.
            const raw = field.value as string | undefined;
            const currentValue = raw ?? "";
            return (
              <Select
                value={currentValue}
                onValueChange={(v) =>
                  field.onChange(v === "__clear" || v == null ? "" : String(v))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={addValue} />
                </SelectTrigger>
                <SelectContent>
                  {!def.required && (
                    <SelectItem value="__clear">{t("clearOption")}</SelectItem>
                  )}
                  {def.options.map((opt) => (
                    <SelectItem key={opt.id} value={opt.value}>
                      {optionLabel(opt, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }}
        />
      );

    case "MULTI_SELECT":
      return (
        <Controller
          control={form.control}
          name={`${baseName}.options` as const}
          render={({ field }) => {
            const options = def.options.map((opt) => ({
              value: opt.value,
              label: optionLabel(opt, locale),
            }));
            return (
              <ConstrainedValuesInput
                values={(field.value as string[]) ?? []}
                onChange={(values) => field.onChange(values)}
                options={options}
                placeholder={addValue}
              />
            );
          }}
        />
      );

    default:
      return (
        <p className="text-xs text-muted-foreground">
          {t("unsupported", { type: String(def.type) })}
        </p>
      );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function optionLabel(opt: AttributeOption, _locale: string): string {
  return translatable(opt.label) || opt.value;
}


function AttributesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
