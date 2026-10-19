/**
 * What a domain's state looks like on screen.
 *
 * The server stores four coarse statuses (`ShopDomainStatus`) and, for one
 * domain at a time, five live checks (`ShopDomainConfiguration.checks`). The
 * screen speaks in five *setup states* instead — the words a merchant needs:
 * it needs setting up, the DNS is wrong, we are provisioning, it works, or it
 * broke. `setupState()` is the one place those are derived, so the pill in
 * the table, the pill beside the detail heading, the hero picture and the
 * step icons can never disagree about a domain.
 */

export type DomainStatus = "PENDING" | "VERIFYING" | "ACTIVE" | "FAILED";

export type TlsState =
  | "PENDING"
  | "PROVISIONING"
  | "READY"
  | "FAILED"
  | "UNKNOWN";

export interface DomainChecks {
  dns_configured: boolean;
  dns_propagated: boolean;
  ownership_verified: boolean;
  routing_ready: boolean;
  tls: TlsState;
}

export type SetupState =
  | "NEEDS_SETUP"
  | "INVALID_DNS"
  | "PROVISIONING"
  | "CONNECTED"
  | "ERROR";

/**
 * The one-word answer, derived from the five checks.
 *
 * Derived rather than stored so the pill and the steps can never disagree —
 * a merchant seeing "Connected" above unticked steps would trust neither.
 */
export function overallState(
  checks: DomainChecks,
): "connected" | "verifying" | "failed" {
  if (checks.tls === "FAILED") return "failed";
  const allDone =
    checks.dns_configured &&
    checks.dns_propagated &&
    checks.ownership_verified &&
    checks.routing_ready &&
    checks.tls === "READY";
  return allDone ? "connected" : "verifying";
}

/**
 * Where a domain is in its setup.
 *
 * With live `checks` (the detail screen) the answer comes from what DNS says
 * right now, and the stored status only decides one thing: whether wrong DNS
 * is "not set up yet" (the merchant has never pressed Verify) or "invalid"
 * (they did, and it is still wrong). Live evidence outranks the stored row —
 * an ACTIVE domain whose records were deleted reads as invalid here, which is
 * the truth the nightly sweep will catch up with.
 *
 * Without live checks (the list) the stored row has to do. `VERIFYING` covers
 * two situations the merchant experiences very differently, and the row can
 * tell them apart: the provider writes back the records it is still waiting on,
 * so a `VERIFYING` row with records outstanding is wrong DNS, and one with none
 * is right DNS waiting on the platform — the certificate, or the manual
 * provider's attachment step.
 */
export function setupState(
  row: { status: DomainStatus; dns_records?: readonly unknown[] | null },
  checks?: DomainChecks | null,
): SetupState {
  if (checks) {
    if (checks.tls === "FAILED") return "ERROR";
    if (overallState(checks) === "connected") return "CONNECTED";
    if (!checks.dns_configured) {
      return row.status === "PENDING" ? "NEEDS_SETUP" : "INVALID_DNS";
    }
    return "PROVISIONING";
  }
  switch (row.status) {
    case "ACTIVE":
      return "CONNECTED";
    case "FAILED":
      return "ERROR";
    case "PENDING":
      return "NEEDS_SETUP";
    default:
      return (row.dns_records?.length ?? 0) > 0 ? "INVALID_DNS" : "PROVISIONING";
  }
}

export type DomainTone = "ok" | "waiting" | "progress" | "error";

export function setupTone(state: SetupState): DomainTone {
  switch (state) {
    case "CONNECTED":
      return "ok";
    case "PROVISIONING":
      return "progress";
    case "INVALID_DNS":
    case "ERROR":
      return "error";
    default:
      return "waiting";
  }
}

/**
 * Tailwind classes per tone.
 *
 * Neutral grey for `waiting`: a domain nobody has set up yet is not broken and
 * not a warning, it is a step not taken. Red is for DNS that was checked and is
 * wrong, or a certificate that cannot be issued. Blue is the platform's turn —
 * the merchant has finished and something is being provisioned. Green is an
 * address customers can open.
 */
export const TONE_CLASS: Record<DomainTone, string> = {
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  waiting:
    "bg-neutral-200/80 text-neutral-700 dark:bg-neutral-700/60 dark:text-neutral-200",
  progress: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  error: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

/**
 * Whether a status means the merchant still has DNS work in front of them.
 *
 * Gates the "I updated DNS records" button: it is the only thing that advances
 * the stored status, so it stays on screen until the row says ACTIVE.
 */
export function needsSetup(status: DomainStatus): boolean {
  return status !== "ACTIVE";
}
