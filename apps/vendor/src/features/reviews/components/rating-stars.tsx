import { StarIcon } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"

interface RatingStarsProps {
  rating: number
  /** Tailwind size class for one star. */
  className?: string
  /** Screen-reader text, e.g. "Rated 4 out of 5". Required — stars alone say nothing. */
  label: string
}

/**
 * Five stars, `rating` of them filled.
 *
 * Not flipped in RTL on purpose: a star row is a quantity, not a direction, and
 * Arabic reviews still read "4 of 5" left-to-right in every storefront we
 * mirror. `dir="ltr"` pins that regardless of the page direction.
 */
export function RatingStars({ rating, className, label }: RatingStarsProps) {
  return (
    <span
      dir="ltr"
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          aria-hidden
          className={cn(
            "size-3.5",
            star <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-muted-foreground/40",
            className,
          )}
        />
      ))}
    </span>
  )
}
