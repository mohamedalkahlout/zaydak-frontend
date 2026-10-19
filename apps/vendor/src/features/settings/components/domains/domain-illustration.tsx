"use client";

/**
 * The picture on the "change your store address" card: a tilted address tag
 * with the platform's part of the address on it and a cursor about to pick it
 * up, over a faint grid.
 *
 * Drawn in CSS and one inline SVG rather than shipped as an image so the tag
 * carries the deployment's real address shape — a blank then `.zaydak.com` on
 * a subdomain-scoped storefront, the storefront host then a blank on a
 * path-scoped one — and so it takes the theme's own colours in dark mode.
 * Purely decorative and hidden from assistive tech; the card's text says
 * everything it does.
 */
export function AddressIllustration({
  prefix = "",
  suffix = "",
}: {
  /** What comes before the handle, e.g. `shop.example.com/`. */
  prefix?: string;
  /** What comes after it, e.g. `.zaydak.com`. */
  suffix?: string;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 end-0 hidden w-80 select-none overflow-hidden sm:block"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:22px_22px] opacity-60 [mask-image:radial-gradient(ellipse_at_60%_50%,black_30%,transparent_78%)]" />
      <div
        dir="ltr"
        className="absolute start-8 top-[26%] -rotate-6 rounded-full bg-card px-5 py-2.5 font-mono text-sm whitespace-nowrap text-foreground shadow-md ring-1 ring-foreground/10"
      >
        {prefix}
        <span className="mx-1 inline-block w-12 border-b-2 border-dashed border-muted-foreground/50 align-middle" />
        {suffix}
      </div>
      <ChromeArrow className="absolute start-44 top-[52%] size-16 rotate-[-18deg] drop-shadow-[0_8px_10px_rgba(0,0,0,0.25)]" />
    </div>
  );
}

/** A metallic cursor, shaded with a gradient rather than a photograph. */
function ChromeArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className}>
      <defs>
        <linearGradient id="chrome-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fafafa" />
          <stop offset="0.35" stopColor="#c9c9c9" />
          <stop offset="0.5" stopColor="#f2f2f2" />
          <stop offset="0.7" stopColor="#9a9a9a" />
          <stop offset="1" stopColor="#dedede" />
        </linearGradient>
        <linearGradient id="chrome-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8c8c8c" />
          <stop offset="1" stopColor="#4a4a4a" />
        </linearGradient>
      </defs>
      {/* The bevelled side, drawn first so the face sits on top of it. */}
      <path
        d="M14 8 L52 30 L34 36 L44 56 L36 60 L26 40 L14 52 Z"
        fill="url(#chrome-edge)"
        transform="translate(2 3)"
      />
      <path
        d="M14 8 L52 30 L34 36 L44 56 L36 60 L26 40 L14 52 Z"
        fill="url(#chrome-face)"
        stroke="#6b6b6b"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <path d="M17 13 L42 28 L31 32 Z" fill="#ffffff" opacity="0.55" />
    </svg>
  );
}
