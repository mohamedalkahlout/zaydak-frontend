import { useTranslations } from "next-intl"
import { WarehouseIcon } from "lucide-react"
import type { InventoryLocationsResult } from "@/features/ai/lib/types"
import { ResultCardShell } from "./result-card-shell"

interface Props {
  result: InventoryLocationsResult
}

/**
 * The shop's warehouses, and — when the lookup named a product — what that
 * product has in each.
 *
 * This card is what makes the assistant's "which warehouse?" question
 * answerable in the vendor's own words: the row it opens onto is the list
 * they are choosing from, with the default marked, so a name they type back
 * ("مخزن جدة") is one they can see rather than one they have to remember.
 *
 * The quantity columns appear only when the tool was asked about a product,
 * because that is the only case where the numbers mean anything.
 */
export function InventoryLocationsCard({ result }: Props) {
  const t = useTranslations("aiChat.toolCards.inventoryLocations")
  const hasLevels = result.locations.some((l) => l.available !== undefined)

  return (
    <ResultCardShell
      icon={WarehouseIcon}
      title={t("title")}
      accent="indigo"
      trailing={String(result.count)}
    >
      {result.locations.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-1">
          {result.locations.map((loc) => (
            <li
              key={loc.id}
              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">
                    {loc.name}
                  </span>
                  {loc.is_default && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                      {t("default")}
                    </span>
                  )}
                  {!loc.is_active && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                      {t("off")}
                    </span>
                  )}
                </div>
                {(loc.city || !loc.fulfills_online_orders) && (
                  <div className="truncate text-[10px] text-muted-foreground">
                    {[
                      loc.city,
                      // Worth saying: stock sitting somewhere that never
                      // ships an online order is stock the storefront
                      // cannot sell.
                      loc.fulfills_online_orders ? null : t("notOnline"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>
              {hasLevels && (
                <div className="shrink-0 text-end">
                  <div className="text-sm font-semibold tabular-nums">
                    {loc.available ?? 0}
                  </div>
                  {(loc.committed ?? 0) > 0 && (
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      {t("committed", { count: loc.committed ?? 0 })}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </ResultCardShell>
  )
}
