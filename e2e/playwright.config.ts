import { defineConfig, devices } from "playwright/test"
import { ARTIFACT_DIR, BASE_URL, E2E_DIR, STORAGE_STATE } from "./lib/env"
import path from "node:path"

/**
 * Browser tests for things jsdom cannot see.
 *
 * Deliberately not wired to CI and deliberately without a `webServer` block.
 * The suite measures a *dev build* of the vendor dashboard against the local
 * Docker API and a seeded database, and both of those are set up by hand (see
 * README.md). A `webServer` that boots `next dev` on demand would hide the one
 * failure mode that actually bites here — a stale Turbopack dev cache serving a
 * 404 for a route that exists — behind a green start-up line.
 *
 * `playwright` rather than `@playwright/test` in every import: the runner ships
 * inside the `playwright` package that is already in the root `node_modules`,
 * so this suite adds no dependency and no lockfile churn.
 */
export default defineConfig({
  testDir: E2E_DIR,
  outputDir: path.join(E2E_DIR, ".report", "artifacts"),
  // One worker: every project drives the same seeded vendor and the same shop,
  // and two browsers typing into the same account's panel is not a test of
  // anything.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(E2E_DIR, ".report", "html"), open: "never" }],
  ],
  expect: { timeout: 10_000 },
  timeout: 120_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    // The composer measures glyph positions. A fixed viewport keeps the
    // panel's width — and therefore where every line wraps — reproducible.
    viewport: { width: 1440, height: 900 },
    // Everything measured here is in CSS pixels, so the scale factor changes no
    // assertion; it doubles the resolution of the screenshots, which is the
    // half of this suite a person has to read. The mention tint is 10% alpha
    // over a white pill and is genuinely hard to judge at 1×.
    deviceScaleFactor: 2,
  },
  projects: [
    {
      name: "session",
      testMatch: /lib[\\/]session\.setup\.ts$/,
      timeout: 180_000,
    },
    {
      name: "composer",
      testMatch: /specs[\\/].*\.spec\.ts$/,
      dependencies: ["session"],
      use: {
        ...devices["Desktop Chrome"],
        // Re-stated after the spread: `devices` carries its own viewport and
        // `deviceScaleFactor: 1`, and a project's `use` beats the top-level one.
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        storageState: STORAGE_STATE,
      },
    },
  ],
  metadata: { artifacts: ARTIFACT_DIR },
})
