// ABC class badge skins (A = best sellers → emerald; C = long tail → slate).
const ABC_BADGE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  B: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  C: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  NONE: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
}

export function abcBadgeClass(cls: string): string {
  return ABC_BADGE[cls] ?? ABC_BADGE.NONE
}
