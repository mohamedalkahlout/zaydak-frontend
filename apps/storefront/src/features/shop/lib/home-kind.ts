/**
 * Which home a shop renders. doughn, drip, rail, hullo, personne and jurat
 * replace the default home. Every other id keeps the storefront shell.
 */
export type StorefrontHomeKind =
  | "doughn"
  | "drip"
  | "rail"
  | "hullo"
  | "personne"
  | "jurat"
  | "default"

export type StorefrontCheckoutKind =
  | "doughn"
  | "drip"
  | "rail"
  | "hullo"
  | "personne"
  | "jurat"
  | "default"

export function storefrontHomeKind(
  template: string | null | undefined,
): StorefrontHomeKind {
  if (
    template === "doughn" ||
    template === "drip" ||
    template === "rail" ||
    template === "hullo" ||
    template === "personne" ||
    template === "jurat"
  ) {
    return template
  }
  return "default"
}

/** The template paints the home, so the shell drops its header and footer. */
export function templateOwnsHome(template: string | null | undefined): boolean {
  return storefrontHomeKind(template) !== "default"
}

/**
 * Which checkout a shop renders. doughn, drip, rail, hullo, personne and jurat
 * each paint their own checkout. Anything else keeps the storefront form.
 */
export function storefrontCheckoutKind(
  template: string | null | undefined,
): StorefrontCheckoutKind {
  if (
    template === "doughn" ||
    template === "drip" ||
    template === "rail" ||
    template === "hullo" ||
    template === "personne" ||
    template === "jurat"
  ) {
    return template
  }
  return "default"
}

/** The template paints checkout, so the shell drops its header and footer. */
export function templateOwnsCheckout(
  template: string | null | undefined,
): boolean {
  return storefrontCheckoutKind(template) !== "default"
}
