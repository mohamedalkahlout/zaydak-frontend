import { centsToMajor } from "@/shared/lib/format"
import { sharePercent, type ChannelMeasure } from "../../lib/channel-mix"

/**
 * A channel share for display, e.g. "86%", in the dashboard's locale.
 * A real slice under half a percent reads "under 1%" (via `below`, which
 * carries the translated wording) rather than "0%".
 */
export function formatShare(
  fraction: number,
  locale: string,
  below: (share: string) => string,
): string {
  const percent = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value / 100)
  const share = sharePercent(fraction)
  return share.kind === "below-one" ? below(percent(1)) : percent(share.percent)
}

/** A count in the dashboard's locale ("1,204", "١٬٢٠٤"). */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value)
}

/**
 * A y-axis tick: compact ("1.2K"), in major units for money. The chart plots
 * cents so its tooltip can hand them straight to `formatMoneyCents`; only the
 * tick is scaled, through the shared `centsToMajor`.
 */
export function formatAxisTick(
  value: number,
  measure: ChannelMeasure,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(measure === "sales" ? centsToMajor(value) : value)
}
