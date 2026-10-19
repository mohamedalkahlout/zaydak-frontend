/**
 * Labels under the apex that are never a shop.
 *
 * **A mirror, not the rule.** The boundary is
 * `back-end/src/shops/lib/reserved-handles.ts`, which refuses these at the
 * moment a handle is claimed; nothing here can stop a merchant from taking a
 * name. This copy exists so the storefront can answer a request for
 * `www.<root>` or `mail.<root>` without a round trip, and so the two halves of
 * the system cannot silently disagree about what `admin.<root>` means.
 *
 * The same shape as `HANDLE_PATTERN` in the dashboard's Domains pane mirroring
 * `UpdateShopInput.slug`: the server is the authority, the client is told early.
 *
 * It is a **complete** copy, including the mail and DNS record names (`smtp`,
 * `mx`, `autodiscover`) that no browser will ever ask this app for. Carrying
 * them costs a few strings; leaving them out costs an inconsistency, and an
 * inconsistency between two copies of a security-adjacent list is the thing
 * that eventually gets read as a rule rather than an oversight. The two lists
 * agree or the comment above them is false.
 *
 * Keep this in step when the back-end list changes.
 */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set<string>([
  // The apex's own aliases and the platform's other deployments. `dash` and
  // `admin` are separate Vercel projects and never reach this one — this is
  // defence in depth, so that a DNS mistake shows the marketplace rather than
  // one merchant's storefront wearing the console's address.
  "www",
  "admin",
  "dash",
  "dashboard",
  "api",
  "app",
  "cdn",
  "assets",
  "static",
  "media",
  "files",
  "uploads",
  "img",
  "images",

  // Mail and DNS record names. These never reach this app — they are here so
  // the two lists match, and because a merchant who claims `mail` sees nothing
  // wrong while the breakage lands on whoever runs email for the apex.
  "mail",
  "email",
  "smtp",
  "imap",
  "pop",
  "mx",
  "ns",
  "ns1",
  "ns2",
  "dns",
  "ftp",
  "vpn",
  "autodiscover",
  "autoconfig",
  "webmail",
  "exchange",
  "lyncdiscover",
  "sip",
  "enterpriseregistration",
  "enterpriseenrollment",
  "_domainkey",
  "dkim",
  "dmarc",
  "spf",

  // Anything that reads as an auth or billing surface. Served from the
  // platform's own wildcard certificate, `login.<root>` is indistinguishable
  // from a first-party sign-in page to the person looking at it.
  "auth",
  "login",
  "signin",
  "sign-in",
  "signup",
  "sign-up",
  "register",
  "logout",
  "password",
  "verify",
  "oauth",
  "sso",
  "account",
  "accounts",
  "billing",
  "checkout",
  "pay",
  "payment",
  "payments",
  "invoice",
  "invoices",
  "secure",

  // Company surfaces, reserved before they are needed. Free now, a negotiation
  // later.
  "support",
  "help",
  "helpdesk",
  "docs",
  "documentation",
  "developers",
  "developer",
  "status",
  "blog",
  "news",
  "press",
  "about",
  "careers",
  "jobs",
  "legal",
  "privacy",
  "terms",
  "security",
  "contact",
  "partners",
  "affiliates",
  "community",
  "forum",
  "shop",
  "shops",
  "store",
  "stores",
  "marketplace",
  "platform",
  "zaydak",

  // Environments. A merchant on `staging.<root>` is indistinguishable from the
  // platform's own staging deploy to everyone who reads the link, including
  // the people who operate it.
  //
  // `demo`, `test`, `beta` and `alpha` are deliberately NOT here. They read
  // like environment names, but they are also ordinary shop handles — `demo`
  // and `test` are the two the product uses as its own worked examples, and
  // `alpha`/`beta` are real trading names. A reservation that blocks a
  // merchant from their own brand is worse than an address that looks like a
  // staging box, so the line is drawn at names no shop would ever be called.
  "staging",
  "stage",
  "dev",
  "development",
  "sandbox",
  "preview",
  "local",
  "localhost",
  "internal",
  "example",
])
