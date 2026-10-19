// Teal heat scale for the cohort-retention grid: 0% → faint, 100% → strong.
// recharts isn't involved (it's an HTML table), but the palette matches the
// rest of analytics (brand teal). A faint floor keeps 0% cells visible.
export function cohortCellStyle(bps: number): {
  backgroundColor: string
  color: string
} {
  const pct = Math.min(1, Math.max(0, bps / 10000))
  const alpha = 0.08 + 0.85 * pct
  return {
    backgroundColor: `rgba(13, 148, 136, ${alpha.toFixed(3)})`,
    color: pct > 0.55 ? "#ffffff" : "#0f172a",
  }
}
