# Runbook — the AI & Integrations items no code can close

**Last updated:** 2026-09-14

Three items in `TODO.md` §AI & Integrations need somebody with a production
console open. This is what each one actually takes, with the values filled in.

One of the three turned out to be smaller than its TODO entry said, and one
turned out to have no route at all resembling what the entry described. Both are
corrected below rather than restated.

---

## 1. Apply the store-import schema to the deployed database

**Correction, and it changes the item: there is no manual step.** The TODO entry
reads as a migration somebody has to run. Every object in
`2026-09-14-store-import-tables.sql` and `2026-09-14-store-import-decisions.sql`
— three tables, three enums, four columns, two enum values — is declared in
`schema.prisma`, and the deployed build command runs
`npm run db:deploy`, which is `prisma db push`. So **the next deploy creates all
of it**. Verified: nothing in either file is a partial index, a CHECK or a
trigger, which are the things `db push` cannot express and which is why other
manual migrations in this repo exist.

Two preconditions, both already true, both worth knowing because getting either
wrong is silent:

- The three tables are **not** in `tables.external` in `prisma.config.ts`, and
  must never be. That list keeps `db push` away from tables Prisma does not
  model; naming one it *does* model excludes it from the very push meant to
  maintain it, and Prisma's data-loss guard keys on the table being non-empty —
  so a deploy shortly after the table fills would drop it **silently** and go
  green, resurfacing much later as `relation … does not exist`.
- `ALTER TYPE … ADD VALUE` is kept outside the transaction in both files,
  because a new enum member is unusable until its own transaction commits.

### If you want it applied before the next deploy

`npm run migrate:local` **cannot** do this. It refuses any host that is not
loopback and there is no override flag — deliberately
(`prisma/apply-manual-migrations.cjs:11`). The TODO's phrasing about "an explicit
override" was wrong; there is none.

Apply it by hand, having read the file:

```bash
psql "$PRODUCTION_DATABASE_URL" -f back-end/prisma/migrations/manual/2026-09-14-store-import-tables.sql
psql "$PRODUCTION_DATABASE_URL" -f back-end/prisma/migrations/manual/2026-09-14-store-import-decisions.sql
```

Both are idempotent and re-runnable, and both `RAISE NOTICE` what they found —
so a run that changed nothing is distinguishable from a run that matched
nothing. Use the **direct** (non-pooled) Neon host: Prisma's own config derives
it by stripping `-pooler.` from the endpoint id.

### Verification (already done locally)

Applied to the local Docker database on 2026-09-14, twice, to prove
idempotency. Result: the three tables exist, `IntegrationType.SCRAPING` is
present, all four decision columns are present, and `DirectChannel.CONTACT_FORM`
is present. The second run reported every object as "already exists, skipping"
and exited OK.

```
psql> \dt store_import*
 public | store_import_jobs        | table
 public | store_import_media       | table
 public | store_import_product_map | table
```

---

## 2. Replicate webhook configuration

**Correction: this is no longer an environment variable, and the signature
verification the entry asks for already ships.**

The TODO says "Set `REPLICATE_WEBHOOK_URL` in production environment and verify
webhook payload signature verification". Both halves have moved on:

- The value lives in the **admin console**, on the `AI_MEDIA` integration row —
  `webhook_base_url` and `webhook_secret`
  (`back-end/src/integrations/provider-registry.ts:834`). The environment
  variables remain only as `envFallback` (`:847`), for a deployment that
  configured Replicate before the console existed.
- Signature verification is implemented and tested — the Replicate strategy
  verifies an svix `webhook-signature`, and
  `back-end/src/ai/image/strategies/replicate.strategy.spec.ts` pins it
  (`:46`, `:98`, `:215`). There is nothing to build.

### Steps

1. Admin console → **Integrations → AI image & video** (`/integrations/AI_MEDIA`).
2. `webhook_base_url` — the API's public origin, no trailing path. The back-end
   appends the route itself. The receiver is `POST /webhooks/replicate`.
3. `webhook_secret` — from the Replicate dashboard's webhook signing secret. It
   starts `whsec_`.
4. Press **Verify**. It calls Replicate's free `/v1/account` endpoint — the
   documented token check that costs nothing. There is deliberately **no Send
   test** on this type: the cheapest call a generation provider accepts still
   starts a billable prediction.
5. Confirm the screen reports the resolved source as the database rather than
   the environment. That is the line that tells you the console value won, and
   the whole reason the screen leads with resolved status rather than
   `is_enabled`.

**Do not rotate `APP_SECRET` before `SECRETS_ENCRYPTION_KEY` is set** — a
separate open item, and doing it in the wrong order orphans every stored
integration secret including this one.

---

## 3. ScrapingBee — account, funding, key

This one is exactly what its entry says: no code moves it. What is already
built, so you know what the key switches on:

- `IntegrationType.SCRAPING` exists in the Prisma enum and in the deployed
  database (verified above).
- The full ScrapingBee provider spec is in the registry
  (`provider-registry.ts:1465`), including a `monthly_credit_cap` field.
- An **`off` provider** exists beside it (`:1546`, `SCRAPING_OFF_PROVIDER`),
  built on the `AI_MEDIA` precedent and for the same reason: disabling the real
  row would silently hand extraction back to a `SCRAPINGBEE_API_KEY` in the
  environment while the screen showed the type as off. Enabling a
  credential-free `off` provider is still an enabled row, so the env fallback
  never runs.
- The admin console already lists the type (`apps/admin/src/features/integrations/nav.ts:42`).

### Steps

1. Create the ScrapingBee account and fund it. Note the plan's monthly credit
   allowance — you will type it into the form.
2. Admin console → **Integrations → Scraping**.
3. Provider **ScrapingBee**, paste `api_key`, set `monthly_credit_cap` to the
   plan's allowance.
4. **Verify.**
5. Leave it on the **`off` provider** until the P3 connector is actually wanted
   in production. The connector degrades to the free Shopify and WooCommerce
   paths when the provider is off, so nothing breaks — those two cover the
   platforms that matter first, at zero provider cost, which is the whole reason
   ScrapingBee is the last connector rather than the first.

### What to watch once it is on

A credit is not a fixed price: ScrapingBee charges more per request for JS
rendering and premium proxies. The job row records the provider's own unit
(`provider_credits`) as the truth and derives `cost_cents` from a
`pricing_snapshot` taken at execution time — so an old job can still be
explained later, which a bare cents figure could not do.

---

## Not in this runbook

`STOREFRONT_APEX_IP`, Upstash eviction, the Redis plan, Twilio, Resend and the
production seeds are all open items too, but they belong to **Platform &
infrastructure**, not here. `docs/go-live-checklist.md` is their home.
