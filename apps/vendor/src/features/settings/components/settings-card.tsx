import { cn } from "@/shared/lib/utils"

/**
 * The card every settings pane is built out of: a title, an optional line of
 * explanation, and the pane's own content below them.
 *
 * Shared rather than copied because the panes sit behind one rail — General and
 * Plan are one click apart, and a card whose padding or ring drifted in one of
 * them would read as a different product on the other side of that click.
 *
 * `className` lands on the content wrapper, not the card, so a pane can lay its
 * own rows out without being able to change the frame they sit in. `footer` is
 * the one thing that reaches outside that wrapper: it is a full-bleed strip on
 * the card's own edge, which is where Shopify puts the aside that belongs to a
 * card rather than to any row inside it.
 */
export function SettingsCard({
  id,
  title,
  description,
  footer,
  children,
  className,
}: {
  /** Anchor for an in-page link — the Brand checklist scrolls to these. */
  id?: string
  title: string
  description?: string
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      className="scroll-mt-4 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
    >
      <div className="p-4">
        <div className="mb-3">
          <h2 className="font-heading text-base leading-snug font-medium">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className={cn(className)}>{children}</div>
      </div>
      {footer && (
        <div className="border-t border-border bg-muted/40 px-4 py-3 text-sm">
          {footer}
        </div>
      )}
    </section>
  )
}
