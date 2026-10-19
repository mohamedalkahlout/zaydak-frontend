import fs from "node:fs"
import path from "node:path"

/**
 * Where the browser tests point, and who they sign in as.
 *
 * Everything here is overridable by environment variable and has a local-dev
 * default, because the suite is run by hand against a dev server rather than
 * by CI — there is no `webServer` block in the config for the same reason (see
 * the README: Turbopack's dev cache has to be reasoned about by a human, and a
 * runner that silently boots its own server hides that).
 */

// `__dirname`, not `import.meta.url`: the repo root has no `"type": "module"`,
// so Playwright transpiles these files to CommonJS and `import.meta` is a
// syntax error there.
export const E2E_DIR = path.resolve(__dirname, "..")
export const REPO_ROOT = path.resolve(E2E_DIR, "..")

/** The vendor dashboard's dev server. */
export const BASE_URL = process.env.E2E_VENDOR_URL ?? "http://localhost:3001"

/** The API the dashboard talks to. Used directly only to pick a shop. */
export const GRAPHQL_URL =
  process.env.E2E_GRAPHQL_URL ??
  process.env.NEXT_PUBLIC_GRAPHQL_URL ??
  "http://localhost:3000/graphql"

export const VENDOR_EMAIL =
  process.env.E2E_VENDOR_EMAIL ?? "vendor@zaydak.com"

/** The signed-in session the specs reuse, written by `session.setup.ts`. */
export const STORAGE_STATE = path.join(E2E_DIR, ".auth", "vendor.json")
/** The shop the session lands on, discovered once by the same setup. */
export const SHOP_FILE = path.join(E2E_DIR, ".auth", "shop.json")
/** Screenshots a human has to look at.  */
export const ARTIFACT_DIR = path.join(E2E_DIR, ".artifacts")

/**
 * The seeded vendor's password.
 *
 * It is deliberately NOT a literal in this repo. Order of resolution:
 * `E2E_VENDOR_PASSWORD`, then the `SEED_VENDOR_PASSWORD` the local API was
 * seeded from, then `prisma/fix-passwords.ts`'s own default — which is the
 * value a developer gets by running that script with no env set, so it is the
 * one case where a literal is correct rather than a leaked secret.
 *
 * Never log the return value. `session.setup.ts` reports *which source*
 * answered, which is the only part that helps when a login fails.
 */
export function vendorPassword(): { value: string; source: string } {
  const fromEnv = process.env.E2E_VENDOR_PASSWORD
  if (fromEnv) return { value: fromEnv, source: "E2E_VENDOR_PASSWORD" }

  for (const file of [".env", ".env.development", ".env.local"]) {
    const abs = path.join(REPO_ROOT, "back-end", file)
    if (!fs.existsSync(abs)) continue
    const line = fs
      .readFileSync(abs, "utf8")
      .match(/^SEED_VENDOR_PASSWORD=(.*)$/m)
    const value = line?.[1]?.trim().replace(/^["']|["']$/g, "")
    if (value) return { value, source: `back-end/${file}` }
  }

  return { value: "123oO456$$", source: "fix-passwords.ts default" }
}

export interface DiscoveredShop {
  slug: string
  /** How many products the picker will have to offer. */
  productCount: number
}

export function readDiscoveredShop(): DiscoveredShop {
  if (!fs.existsSync(SHOP_FILE)) {
    throw new Error(
      `No shop recorded at ${SHOP_FILE}. Run the "session" project first ` +
        `(it runs automatically as a dependency of "composer").`,
    )
  }
  return JSON.parse(fs.readFileSync(SHOP_FILE, "utf8")) as DiscoveredShop
}
