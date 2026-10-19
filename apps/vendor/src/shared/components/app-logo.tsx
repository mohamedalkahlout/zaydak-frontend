import Image from "@/shared/components/app-image";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";

export interface AppLogoProps {
  /**
   * - "responsive": `logo-mobile.svg` on mobile (< md), `logo-desktop.svg` on desktop (>= md).
   * - "desktop": always `logo-desktop.svg`.
   * - "mobile": always `logo-mobile.svg`.
   */
  variant?: "responsive" | "desktop" | "mobile";
  /** Preset heights with proportional widths. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Destination route when clicked. Pass empty string or null to render without an anchor. */
  href?: string | null;
  /** Extra container class names. */
  className?: string;
  /** Prioritize image loading for above-the-fold brand visibility. */
  priority?: boolean;
  /** Accessible name when the mark is a link. Callers pass a localized string. */
  ariaLabel?: string;
}

const SIZE_MAP = {
  sm: {
    mobileClass: "h-6 w-auto",
    desktopClass: "h-6 w-auto",
    mobileWidth: 44,
    mobileHeight: 24,
    desktopWidth: 94,
    desktopHeight: 24,
  },
  md: {
    mobileClass: "h-7 w-auto",
    desktopClass: "h-7 w-auto",
    mobileWidth: 50,
    mobileHeight: 28,
    desktopWidth: 110,
    desktopHeight: 28,
  },
  lg: {
    mobileClass: "h-9 w-auto",
    desktopClass: "h-9 w-auto",
    mobileWidth: 65,
    mobileHeight: 36,
    desktopWidth: 140,
    desktopHeight: 36,
  },
  xl: {
    mobileClass: "h-12 w-auto",
    desktopClass: "h-12 w-auto",
    mobileWidth: 86,
    mobileHeight: 48,
    desktopWidth: 188,
    desktopHeight: 48,
  },
} as const;

export function AppLogo({
  variant = "responsive",
  size = "md",
  href = "/store",
  className,
  priority = true,
  ariaLabel = "Home",
}: AppLogoProps) {
  const s = SIZE_MAP[size];

  const content = (
    <span
      className={cn(
        "inline-flex items-center select-none shrink-0",
        className,
      )}
    >
      {variant === "mobile" && (
        <Image
          src="/logo-mobile.svg"
          alt="Zaydak"
          width={s.mobileWidth}
          height={s.mobileHeight}
          priority={priority}
          unoptimized
          className={cn("object-contain", s.mobileClass)}
        />
      )}

      {variant === "desktop" && (
        <Image
          src="/logo-desktop.svg"
          alt="Zaydak"
          width={s.desktopWidth}
          height={s.desktopHeight}
          priority={priority}
          unoptimized
          className={cn("object-contain", s.desktopClass)}
        />
      )}

      {variant === "responsive" && (
        <>
          <Image
            src="/logo-mobile.svg"
            alt="Zaydak"
            width={s.mobileWidth}
            height={s.mobileHeight}
            priority={priority}
            unoptimized
            className={cn("object-contain md:hidden", s.mobileClass)}
          />
          <Image
            src="/logo-desktop.svg"
            alt="Zaydak"
            width={s.desktopWidth}
            height={s.desktopHeight}
            priority={priority}
            unoptimized
            className={cn("hidden object-contain md:block", s.desktopClass)}
          />
        </>
      )}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label={ariaLabel}
      >
        {content}
      </Link>
    );
  }

  return content;
}
