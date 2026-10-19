/**
 * Shopify-flavored empty-state illustrations for the inventory subpages.
 * Each sits on a soft circular backdrop and uses the teal/orange accent
 * palette to match the existing `/empty-state-*.svg` artwork.
 */

const TEAL = "#0d9488"
const TEAL_DARK = "#0f766e"
const ORANGE = "#f97316"
const PAPER = "#ffffff"
const LINE = "#e5e7eb"
const STROKE = "#d1d5db"

function Backdrop() {
  return <circle cx="80" cy="80" r="64" className="fill-muted/60" />
}

/** Purchase orders — a document/form with a stamped order box. */
export function PurchaseOrdersIllustration({
  className,
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <Backdrop />
      <rect
        x="48"
        y="38"
        width="64"
        height="80"
        rx="6"
        fill={PAPER}
        stroke={STROKE}
        strokeWidth="1.5"
      />
      <rect x="58" y="50" width="30" height="6" rx="3" fill={TEAL} />
      <rect x="58" y="66" width="44" height="3.5" rx="1.75" fill={LINE} />
      <rect x="58" y="75" width="44" height="3.5" rx="1.75" fill={LINE} />
      <rect x="58" y="84" width="32" height="3.5" rx="1.75" fill={LINE} />
      {/* Stamped "received" badge */}
      <circle cx="98" cy="100" r="14" fill={ORANGE} />
      <path
        d="M92 100.5 L96 104.5 L104 96"
        stroke={PAPER}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Transfers — two boxes with a flow arrow between them. */
export function TransfersIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <Backdrop />
      {/* Source box */}
      <rect x="40" y="74" width="34" height="30" rx="3" fill={TEAL} />
      <path d="M40 82 L74 82" stroke={TEAL_DARK} strokeWidth="1.5" />
      <rect x="52" y="74" width="10" height="6" rx="1.5" fill={TEAL_DARK} />
      {/* Destination box */}
      <rect x="86" y="74" width="34" height="30" rx="3" fill={ORANGE} />
      <path d="M86 82 L120 82" stroke="#c2410c" strokeWidth="1.5" />
      <rect x="98" y="74" width="10" height="6" rx="1.5" fill="#c2410c" />
      {/* Flow arrow */}
      <path
        d="M70 56 Q80 46 90 56"
        stroke={STROKE}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M86 52 L91 57 L86 62"
        stroke={STROKE}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Suppliers — a storefront/warehouse facade. */
export function SuppliersIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <Backdrop />
      {/* Awning */}
      <path d="M46 60 L114 60 L108 72 L52 72 Z" fill={ORANGE} />
      {/* Building body */}
      <rect x="52" y="72" width="56" height="42" fill={PAPER} stroke={STROKE} strokeWidth="1.5" />
      {/* Door */}
      <rect x="72" y="88" width="16" height="26" rx="1" fill={TEAL} />
      {/* Window */}
      <rect x="58" y="80" width="10" height="10" rx="1" fill={LINE} />
      <rect x="92" y="80" width="10" height="10" rx="1" fill={LINE} />
    </svg>
  )
}

/** Inventory items — a stack of boxes. */
export function InventoryIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <Backdrop />
      {/* Bottom-left box */}
      <rect x="44" y="84" width="34" height="28" rx="3" fill={TEAL} />
      <rect x="56" y="84" width="10" height="6" rx="1.5" fill={TEAL_DARK} />
      {/* Bottom-right box */}
      <rect x="82" y="84" width="34" height="28" rx="3" fill={TEAL} />
      <rect x="94" y="84" width="10" height="6" rx="1.5" fill={TEAL_DARK} />
      {/* Top box */}
      <rect x="63" y="54" width="34" height="28" rx="3" fill={ORANGE} />
      <rect x="75" y="54" width="10" height="6" rx="1.5" fill="#c2410c" />
    </svg>
  )
}
