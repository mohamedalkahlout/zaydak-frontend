# e2e — browser tests for things jsdom cannot see

A small Playwright suite, run by hand against a local dev stack. It exists for
one class of assertion: **layout**. The vitest suites in `apps/*` run in jsdom,
which performs no layout at all — every rectangle it reports is `0×0` — so
anything whose correctness is "this is painted on top of that" is invisible
there and has to be measured in a real engine.

Today that is the vendor dashboard's slide-in AI panel and its inline
`@`-mention composer, plus an RTL walkthrough (`specs/rtl-walkthrough.spec.ts`)
that measures `dir="rtl"` on the vendor products list, the files sheet close
button, and — when those apps are up — the storefront cart drawer and the admin
login screen.

```
e2e/
├── playwright.config.ts          # two projects: "session" (setup) → "composer"
├── lib/
│   ├── env.ts                    # URLs, credentials, discovered shop
│   ├── session.setup.ts          # one sign-in per run, picks a shop with products
│   └── composer.ts               # page object + the measurement
└── specs/
    ├── ai-composer-mentions.spec.ts
    ├── store-import-review.spec.ts
    └── rtl-walkthrough.spec.ts   # T3-20, real Chromium
```

## Running it

Three things have to be up first, and none of them is started by the runner
(there is no `webServer` block on purpose — see *Why no `webServer`* below).

```bash
# 1. the API, Postgres and Redis
docker compose up -d                     # zaydak-api :3000, zaydak-postgres, zaydak-redis

# 2. the vendor dashboard, in dev
cd apps/vendor && npm run dev            # :3001

# 3. the suite, from the repo root
npx playwright test --config e2e/playwright.config.ts
npx playwright test --config e2e/playwright.config.ts --headed      # watch it
npx playwright test --config e2e/playwright.config.ts --ui          # step through it
npx playwright test --config e2e/playwright.config.ts -g "RTL"      # one case
```

Screenshots land in `e2e/.artifacts/` and are attached to the HTML report in
`e2e/.report/html` (`npx playwright show-report e2e/.report/html`). Both
directories are gitignored.

The runner comes from the `playwright` package already in the root
`node_modules` — it ships the full test runner, so every import here is
`from "playwright/test"` rather than `@playwright/test`, and this suite adds no
dependency and no lockfile churn. Chromium is installed by
`npm run bones:setup` in `apps/vendor`, or by `npx playwright install chromium`.

### Environment

Everything has a local default; override only what differs.

| Variable | Default | What it is |
|---|---|---|
| `E2E_VENDOR_URL` | `http://localhost:3001` | the dashboard under test |
| `E2E_GRAPHQL_URL` | `http://localhost:3000/graphql` | the API, used only to pick a shop |
| `E2E_VENDOR_EMAIL` | `vendor@zaydak.com` | the seeded vendor |
| `E2E_VENDOR_PASSWORD` | *(see below)* | that vendor's password |

The password is **not** a literal in this repo. `vendorPassword()` resolves
`E2E_VENDOR_PASSWORD`, then `SEED_VENDOR_PASSWORD` from `back-end/.env`,
`.env.development` or `.env.local`, and finally `prisma/fix-passwords.ts`'s own
default — which is the value a developer gets by running that script with no env
set, so it is the one case where a literal is correct. The setup test reports
*which source* answered as an annotation and never the value.

If the sign-in fails, the local database was last hashed from something none of
those files carries. Re-run it rather than guessing:

```bash
cd back-end && npx tsx prisma/fix-passwords.ts
```

### What the setup step does

`lib/session.setup.ts` signs in **through the real `/login` form** — not by
POSTing the `login` mutation and planting cookies. Planting them is faster, and
was the first version, but it bakes this app's cookie split into the test suite,
so the day `/api/auth/session` changes the suite keeps passing against a session
shape the app no longer issues.

It then **discovers** a shop that actually holds products, and writes the slug
next to the storage state. It has to: `myShops` for the seeded vendor is mostly
empty scratch shops (eleven on the machine this was written on, two with any
products), and `/store` does not necessarily land on one of the two. An
`@`-mention token can only exist by being picked from the picker, so an empty
shop is a suite that can never assert anything — which is the worst kind of
green. If no shop has a product the setup fails loudly and tells you to seed.

## What the composer spec proves, and how

The composer keeps a mention in the draft as plain text (`Restock @Summer
Hoodie`) and paints it by mirroring the draft into a **transparent-text backdrop
behind the real textarea**, tinting the mention runs there. Two boxes, one
glyph stream. The whole design rests on both laying text out identically, and a
backdrop that disagrees by a pixel puts the tint beside the word instead of
under it.

The measurement problem is that a `<textarea>`'s text is **not in the DOM**:
there is no text node to put a `Range` around, so there is no direct way to ask
where the real glyphs are. The usual workaround is to build a third mirror from
the textarea's computed style and measure that — which proves only that two
mirrors agree.

This suite uses `document.caretPositionFromPoint(x, y)` instead. Over a text
control the browser answers with the control itself and a **character offset
into its value**, so a point can be handed to the engine and it will say which
character of the real, laid-out textarea is under it. That turns *"the highlight
sits under its word"* into something mechanical:

1. take the backdrop span's `getClientRects()` — one per visual line;
2. clip each to the textarea's visible box and sample points across it;
3. require every answer to be a character index inside that token's span in
   `textarea.value`.

No model, no second mirror, and it stays true under `rtl`, across a line wrap,
and after the textarea scrolls. Around it sit three checks that need no
sampling at all: the two boxes' layout-deciding computed styles must be
identical, their border boxes must coincide, and the same text must wrap to the
same `scrollHeight`.

### The five cases

| Test | What it pins |
|---|---|
| LTR, single line | the baseline: highlight under its own characters, and the highlight's two ends coincide with the token's |
| RTL, Arabic draft | the same under `dir="rtl"`, preferring a product whose `name.ar` exists — a Latin name inside Arabic prose is the harder bidi case, so a shop without one annotates rather than skips |
| past the 140px cap | the token starts scrolled out of view; after a real mouse wheel the backdrop's `scrollTop` matches, **and** the token's rectangle has moved by the same delta — `scrollTop` agreeing is a property, not a paint |
| wrapped across two lines | the token is walked to a wrap by growing the leading padding (where a line breaks depends on the shop's own product names), then every line's highlight is sampled |
| the conic focus ring | the mechanical half only: opacity 0 → 1 on focus, `compose-ring-spin` running, negative `z-index`, 3px proud of the pill, and inside its nearest clipping ancestor. The look of the sweep against the drifting mesh gradient is left to a screenshot |

Edge sampling — points just outside the highlight — is taken **only for a token
on a single line**. Past the end of a wrapped line the browser clamps to that
line's last character, which is still inside the token, so the check would be
answering a different question there.

### These assertions have been shown to fail

A temporary sabotage spec was run against the passing suite to confirm each
mechanism can actually catch something. All four were caught:

- backdrop shifted 22px → box-parity check;
- backdrop `letter-spacing: 0.6px` → style-parity check;
- backdrop `scrollTop` forced back to 0 after scrolling → lockstep check;
- **only the tint runs** shifted 22px (`position: relative; left`), leaving the
  backdrop's box and every computed style untouched → caught by the caret
  sampling alone, which is the one that had to be proved.

## Why no `webServer`

The suite measures a **dev build** against a seeded database, and both are set
up by hand. A `webServer` block that booted `next dev` on demand would hide the
failure that actually bites here: after source files are deleted or renamed
while the dev server is down, Turbopack's dev cache serves the app's 404 page
for a route that exists, while `tsc`, lint and the unit tests are all green. The
fix is to stop the server, `rm -rf apps/vendor/.next/dev`, and start it again —
and that is a decision for a person, not something to paper over with a green
start-up line.

For the same reason the suite is not wired into CI: it needs a database with a
vendor who owns a shop with products in it.
