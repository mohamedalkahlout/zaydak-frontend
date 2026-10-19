# Go-live checklist

The T0 blockers from [PRIORITIES.md](../PRIORITIES.md), in the order they must be done. Everything here is a one-time action; nothing on this list is code.

**Last updated:** 2026-09-23

Two of these have a hard ordering constraint with each other. Doing them out of order destroys data, so the sequence below is not a suggestion.

---

## Step 0 — already done in the repo

No action needed; listed so the checklist is complete.

- [x] Every real credential removed from the three tracked `.env.example` files and replaced with a shaped placeholder (`back-end`, `apps/vendor`, `apps/admin`). Verified: a pattern scan over tracked files returns no credential-shaped string.
- [x] `AI_IMAGE_ON_MODEL_ENABLED` flipped to `"false"` in the template — it shipped `"true"` while the eval it gates has never been run and output-image moderation does not exist.
- [x] `SECRETS_ENCRYPTION_KEY` documented in the deployment secret table with its ordering constraint.
- [x] `back-end/.env copy` — no longer present and never tracked. Nothing to scrub.
- [x] `ALLOW_SANDBOX_EMAIL_SENDER=1` commented out in `back-end/.env.example`. It shipped uncommented, so every fresh copy of the template started with the guard in Step 5 disarmed.

**Scrubbing the files does not undo the exposure.** The values are in git history and cannot be removed without rewriting it. Rotation at each provider is the only fix, which is Step 2.

---

## Step 1 — set `SECRETS_ENCRYPTION_KEY` first

Must happen **before** `APP_SECRET` is rotated in Step 2.

`SecretCryptoService` falls back to `APP_SECRET` when `SECRETS_ENCRYPTION_KEY` is unset. Rotating `APP_SECRET` first makes every stored envelope permanently unreadable — `DECRYPTION_FAILED`, and every provider has to be re-entered by hand.

Do **not** re-enter providers if a dedicated encryption key is already in use. The current procedure is a rotation window, not a wipe:

1. Generate a key (`openssl rand -hex 32`) in your own terminal, not in a chat window.
2. Put the **currently used** material in `SECRETS_ENCRYPTION_KEY_PREVIOUS` (for the first rotation off the `APP_SECRET` fallback, that is the old `APP_SECRET` value). Set `SECRETS_ENCRYPTION_KEY` to the new key. Restart.
3. Boot log from `SecretRotationService` must show `failed=0`. A second restart must show `0 re-encrypted` / already current, then `Rotation is complete — unset SECRETS_ENCRYPTION_KEY_PREVIOUS`.
4. Unset `SECRETS_ENCRYPTION_KEY_PREVIOUS`. Keep the code path that reads it. Confirm Admin → Integrations and merchant shipping accounts still mask secrets (not empty values / `DECRYPTION_FAILED`).

Isolated local proof (Docker `zaydak`, 2026-09-16): 14 envelopes re-encrypted, second pass clean, PREVIOUS unset, GraphQL reads OK. Log: [p01-secret-rotation-log.md](production-readiness/p01-secret-rotation-log.md). **Render/production has not been rotated in this pass.**

---

## Step 2 — rotate every exposed credential

All of these are in git history and were pasted into chat on 2026-08-09. The repo is private (confirmed 2026-08-11), so exposure is limited to anyone with repo access — including past collaborators and anything that has ever cloned it.

**Not done in the 2026-09-16 local P01 pass.** Local Docker rotated `SECRETS_ENCRYPTION_KEY` and `APP_SECRET` only. Third-party rows in that database name real providers; credentials were **not** revoked at Twilio, Stripe, Sentry, Replicate, Resend, Groq, OpenRouter, Telegram, ScrapingBee, OTO, Evolution, Neon, Upstash, or Bunny. Do that from the provider consoles, then update Render (or Vercel for the Sentry auth token).

Rotate at the provider, then update the value in the Render dashboard. Nothing below is read from a file in production.

| Credential | Where to rotate | Where to update |
|---|---|---|
| Neon `neondb_owner` password | Neon console → project → Roles → reset password | Render `DATABASE_URL` |
| `JWT_SECRET` | `openssl rand -hex 32` | Render. **Signs out every user** — expected, not a fault |
| `APP_SECRET` | `openssl rand -hex 32` | Render. Only after Step 1 |
| Upstash Redis password | Upstash console → database → reset password | Render `REDIS_URL` |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys → revoke + create | Render |
| `GROQ_API_KEY` | console.groq.com → API Keys → revoke + create | Render |
| `REPLICATE_API_TOKEN` | replicate.com/account/api-tokens | Render |
| `REPLICATE_WEBHOOK_SECRET` | Replicate → webhook settings | Render |
| `AI_SERVICE_KEY` | Your own AI service config | Render + the AI service |
| `STRIPE_API_KEY` + `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Developers → API keys / Webhooks | Render |
| BunnyCDN storage key | Bunny → Storage → the zone → FTP & API access → reset | Admin → Integrations → Storage when a row is saved there (it beats the env), else Render `BUNNYCDN_API_KEY` |
| `GEMINI_API_KEY` | aistudio.google.com/apikey → delete + create | Render |
| Mailtrap user + pass | Mailtrap → inbox → SMTP settings → reset | Render |
| **Sentry auth token** (`sntrys_…`) | sentry.io → Settings → Auth Tokens → revoke + create | **Vercel** (vendor project), not Render |

The Sentry token was found in `apps/vendor/.env.example` during this pass and is **not** in the original `TODO.md` list. It carries `project:releases` scope. The Sentry **DSN** in the same file is public by design and does not need rotating.

Verify: `GET /health` returns ok after the restart, and Admin → Integrations → **Send test** delivers for each configured provider.

---

## Step 3 — decide which Neon project is production

`back-end/.env.example` documented `ep-super-butterfly-aqksxtdy` (us-east-1). Render points at `ep-broad-heart-ay62yk2t` (us-east-2). `render.yaml` pins `region: virginia` with a comment saying it co-locates with a **us-east-1** database — that comment no longer matches the instance in use.

Pick one before Step 4, because the seed has to land in the database the API actually reads.

- Whichever you keep, update the `region:` comment in `render.yaml` so it stops asserting something false.
- Cross-region (virginia ↔ us-east-2) adds latency to every query. If you keep the us-east-2 instance, consider moving the Render service to `ohio`.
- Confirm with: `npm run check:drift` against the URL Render actually has.

---

## Step 4 — seed the production database

`prisma db push` runs in the Render build, so the **tables** exist. It does not create rows. Until this runs, `role_permissions` is empty and every plan entitlement is missing — and a missing entitlement **denies**, so every metered capability is silently off for every shop.

From a shell with the production `DATABASE_URL`, `NODE_ENV=production`, `ALLOW_PROD_SEED=true` and the four `SEED_*_PASSWORD` variables set:

```bash
cd back-end
npm run seed             # role_permissions, languages, cities, base users
npm run seed:taxonomy    # system_categories
npm run seed:plans       # features + plan_entitlements
npm run check:drift      # must come back clean
```

Then, for databases that never ran the Prisma baseline migrate, apply the
partial unique index Prisma cannot express (also shipped as
`20260916200001_partial_indexes` for empty migrate deploys):

```bash
npx prisma db execute --file prisma/manual/2026-08-09-integration-configs.sql
```

Other historical notes for hand-patched databases (not needed after baseline migrate):

- `2026-08-11-otp-verified-at.sql` — `verified_at` and the `created_at` index are both in `schema.prisma`.
- `2026-08-10-integration-type-monitoring.sql` — adding an enum label is additive.

`npm run sync:permissions` already runs in the Render build command, so it needs no manual step — but **admins must log out and back in** afterwards, because permissions are baked into the JWT at login.

---

## Step 5 — unblock signup delivery

Vendor signup is hard-blocked today. `assertEmailDeliverable` refuses `startVendorSignup` while the sandbox sender is configured, and the SMS provider is `console`, which writes the code to the server log instead of sending it.

1. **Verify a sending domain** at resend.com/domains (add the DNS records it gives you, wait for verification).
2. Admin → Integrations → Email → set the **From address** to an address on that domain. `sandboxSenderDomain` blocks re-saving `onboarding@resend.dev`, deliberately.
3. Press **Send test**. It is the only check that exercises the sender — `verify()` only proves AUTH.
4. Once mail **actually delivers** — not when `verify()` passes, not when the form saves — **unset `ALLOW_SANDBOX_EMAIL_SENDER`** in Render. With it set, nothing warns you that customers are not receiving mail; the 550 dies in a queue worker.

   > **Order matters, and only in this direction.** Do not unset it first and fix delivery afterwards. `assertEmailDeliverable` re-arms the moment the variable is gone, and while the From address is still a sandbox sender it throws `OTP_SEND_FAILED` (503) on every non-SMS channel — `startVendorSignup` is then hard-blocked, not degraded. Prove the Send test first, then remove the variable.

   Until it is removed, every boot logs `ALLOW_SANDBOX_EMAIL_SENDER_SET` (warn) against a remote database, naming what it disables. That line going quiet is the confirmation the step is done.
5. Configure **Twilio** (account SID, auth token, from number) so SMS is a real fallback rather than a log line, then send an OTP to a real number on the target market's carrier and confirm it arrives.
6. Watch the boot log for `DevSinkCheck`. Until a real provider is configured, a remote deployment logs `DEV_SINK_PROVIDER_IN_PRODUCTION` at ERROR for each type still resolving to a development sink — today that is `SMS=console`, which writes the code to the server log and reports the send as succeeded. It never refuses the boot. Like the line above, it going quiet is what says the step landed.

Note: Render blocks outbound ports 25/465/587 on **free** web services, and a blocked port times out rather than refusing — which is how a working key once got reported as `INTEGRATION_VERIFICATION_FAILED`. Resend's HTTP API is unaffected; SMTP providers are not.

Once delivery works, decide what happens to `revealOtpCode` (super_admin recomputes a live code from its hash). It exists only because delivery is broken pre-launch. Review its use in `audit_logs` under `entity: 'otp'`, `action: ACCESS` before keeping it.

---

## Step 6 — point Vercel at the right directory

Left over from the Turborepo migration: `vendor/` became `apps/vendor/`.

Vercel → the vendor project → Settings → General → **Root Directory** → change `vendor` to `apps/vendor` → redeploy.

Verify: the deployment builds and `/login` renders. Nothing deploys correctly until this is changed.

---

## Step 7 — harden the runtime environment

The live service runs with `NODE_ENV=development`, two debug flags set, and three
URLs pointing at `localhost`. None of it is exploitable exactly as it stands —
and one of them is one character away from being so.

### 7a — `NODE_ENV` and the debug flags

| Variable | Live value | Change it to |
|---|---|---|
| `NODE_ENV` | `development` | **`production`** |
| `ENABLE_DEBUG_OTP` | `true` | **delete the variable** |
| `ENABLE_DEBUG_MAGIC_LINK` | `true` | **delete the variable** |

> **Do not "fix" `ENABLE_DEBUG_OTP=true` to `=1`.**
>
> It reads like normalising a sloppy boolean. It would arm an authentication
> bypass reachable with an `x-debug-mode` header.

The bypass in `AuthService.verifyOtp` is guarded by two independent signals
(`auth.service.ts:519-529`): `NODE_ENV` must not be `production` or `staging`,
**and** `ENABLE_DEBUG_OTP` must be exactly `'1'`. Today the first guard is open
and the second is shut only because `'true' !== '1'` — the door is held by a
string comparison, not by intent. Setting `NODE_ENV=production` shuts the first
one properly; deleting the flags removes the second question entirely.

`NODE_ENV=production` has one deliberate side effect: `npm run seed` then
refuses to run without `ALLOW_PROD_SEED=true` (Step 4). That is the guard
working, not a regression.

### 7b — the URLs that go out to customers

These three are printed into links **the recipient opens**, so a magic link
mailed to a customer currently points at that customer's own machine:

| Variable | Live value | Change it to |
|---|---|---|
| `FRONTEND_URL` | `localhost:3001` | the vendor dashboard's real origin |
| `SHORT_DOMAIN` | `localhost:3000` | the short-link domain |
| `UPLOAD_BASE_URL` | `localhost:3000` | the API origin (or the BunnyCDN pull zone) |

**Ordering constraint:** `CORS_ORIGINS` must contain the deployed origins
**before or in the same save as** `NODE_ENV=production`. `main.ts:170-174`
refuses to start in production with an empty allowlist — it throws rather than
serving a permissive default, which is correct and will fail the deploy if the
origins are not there yet.

### 7c — turn the guard from advisory to blocking

Once 7a and 7b are done, and not before:

| Variable | Set to |
|---|---|
| `DEPLOYMENT_SAFETY_ENFORCE` | `1` |

`DeploymentSafetyService` runs at boot and checks these same conditions against
a remote database. By default it logs at ERROR and alerts; with this set,
critical findings **refuse the boot** instead. Setting it while the environment
is still dirty will fail the current deploy — which is why it is last.

### Verifying

Read the Render logs after the deploy and look for `DeploymentSafety`:

- **A clean environment logs nothing at all.**
- Any line names the variable, the finding code, and what to do about it.

The codes it can raise: `DEV_MODE_AGAINST_REMOTE_DB`, `ENABLE_DEBUG_OTP_ARMED`,
`ENABLE_DEBUG_OTP_SET_BUT_INERT` (the one-character-away case — it is a warning
precisely so nobody "tidies" it), `FRONTEND_URL_IS_LOCALHOST`,
`SECRETS_ENCRYPTION_KEY_MISSING`, `ALLOW_SANDBOX_EMAIL_SENDER_SET`.

`ALLOW_SANDBOX_EMAIL_SENDER_SET` is raised for **any** non-empty value, not only
the armed `1`, and it is a warning rather than a critical for the reason Step 5
gives: enforcing it would refuse the boot over a variable whose removal has an
ordering constraint of its own.

**A second check logs under `DevSinkCheck`, not `DeploymentSafety`.**
`DevSinkAlertService` runs at the same bootstrap and asks a question the
environment cannot answer — which provider each integration type actually
resolves to, after the database-then-`.env` chain. Against a remote database,
any type resolving to a provider that reaches no third party logs
`DEV_SINK_PROVIDER_IN_PRODUCTION` at ERROR and fires one alert naming the type
and the provider. It never refuses a boot, and `DEPLOYMENT_SAFETY_ENFORCE` does
not apply to it: a shop running on the console sink is wrong, but an outage is
worse. The AI-media `off` provider is deliberately not reported — it reaches
nobody by design, and vendors are told the feature is unavailable.

### Do not change

`ALLOW_PROD_SEED=false` is correct. Leave it.

---

## What is deliberately not on this list

- **Removing the secrets from git history.** A rewrite (`filter-repo`) breaks every clone and every open branch, and it does not help once a value is known. Rotation in Step 2 is the fix; the history is only a reason to rotate, not a thing to repair.
- **Anything from T1 and below.** T1 items are real security defects, but they are code changes, not launch actions. See [PRIORITIES.md](../PRIORITIES.md).
