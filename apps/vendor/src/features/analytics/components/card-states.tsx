"use client"

// `ListSkeleton` lived here until 2026-08-17. Every card on this dashboard now
// gets its loading state from `<Bones>` (`shared/components/bones.tsx`), which
// measures the real rows instead of approximating them with equal bars, so
// there is no hand-written placeholder left in this feature to share.

export function EmptyRow({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>
}
