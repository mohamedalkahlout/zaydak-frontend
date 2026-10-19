# Telegram webhooks locally, over ngrok

**Last updated:** 2026-09-02

Testing the real production path — `Telegram → HTTPS → tunnel → localhost:3000 → NestJS` — rather than a second inbound mechanism. `getUpdates` polling is deliberately not used: it is mutually exclusive with a webhook on the same bot, so it would exercise code that never runs in production.

## Why a tunnel is needed here and not for WhatsApp

Evolution runs in Docker **on your machine**, so it reaches the API at `http://host.docker.internal:3000` with no tunnel and no certificate. That is documented in `back-end/docs/features/whatsapp.md` and it does not carry over.

Telegram's servers are on the public internet and know nothing about your network. Its `setWebhook` also enforces two hard rules:

| Rule | Value |
|---|---|
| Protocol | **HTTPS only** |
| Port | **443, 80, 88 or 8443** — nothing else |
| `secret_token` charset | `A-Za-z0-9_-`, 1–256 characters |

So a local address can never be registered, and `npm run telegram:webhook` checks all three before spending a round trip — Telegram's own refusal for a bad port reads as a generic "bad webhook" that looks like a bad token.

## One-time setup

1. **Create the platform bot.** In Telegram, message [@BotFather](https://t.me/BotFather): `/newbot`, give it a name, then a username ending in `bot`. It replies with a token shaped `123456789:AA…`.
2. **Put the token in `back-end/.env.development`** (gitignored — `.env*` is ignored except `.env.example`):
   ```env
   TELEGRAM_BOT_TOKEN="123456789:AA..."
   ```
3. **Install a tunnel.**

   ```powershell
   winget install --id ngrok.ngrok
   ngrok update                        # see the trap below — do not skip this
   ngrok config add-authtoken <token>  # https://dashboard.ngrok.com/get-started/your-authtoken
   ```

   **The winget package is years out of date** — it installed 3.3.1 here, and ngrok refuses any agent below 3.20.0 on a free account. The refusal names the version, but it arrives as `ERR_NGROK_121` *after* the tunnel looks like it started, so it reads as an authentication failure. `ngrok update` is a self-updater and fixes it in place; the authtoken already saved survives it.

   winget also installs no `ngrok.exe` shim under `WindowsApps`, so a shell opened before the install will not find it on `PATH`. Open a new terminal, or call it directly at `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Ngrok.Ngrok_*\ngrok.exe`.

   **Windows Defender quarantines the ngrok binary.** It did here on 2026-09-02 at 23:14 (ThreatID 2147939874), deleting `ngrok.exe` from the WinGet package folder mid-session — the running tunnel died and the next start failed with *"the file contains a virus or potentially unwanted software"*. It is a long-standing false positive on the class of tool rather than a compromise, but the effect is real: the tunnel stops without warning and Telegram's deliveries silently stop with it. Either restore the file from Protection history and add a folder exclusion, or use `cloudflared`, which is not usually flagged.

   `cloudflared` is the alternative and needs **no account and no token** — `cloudflared tunnel --url http://localhost:3000` prints a `trycloudflare.com` address immediately. ngrok earns its setup with the request inspector at `http://127.0.0.1:4040`, which shows every delivery and the status code it got.

## Every session

**1. Start the API** — either way, it must be listening on `localhost:3000`.

Natively:

```bash
cd back-end
npm run start:dev          # http://localhost:3000, no global prefix
```

Or in Docker (`docker-compose.yml` publishes `3000:3000`, so the tunnel reaches it the same way):

```bash
docker compose build api && docker compose up -d api
```

**`docker compose restart api` will not pick up new code** — the image is baked, so a code change needs the `build` above. A `restart` *is* enough for a change to `.env.development`, which is mounted read-only rather than copied in.

That mount is also why the split-brain failure described at the bottom of this file cannot happen here: the container and the host read the **same** `APP_SECRET` from the same file, so the secret the script registers is the secret the receiver derives.

**2. Start the tunnel** in a second terminal, pointing at that port:

```bash
ngrok http 3000
# or:  cloudflared tunnel --url http://localhost:3000
```

**3. Read the public URL.** ngrok prints it in the `Forwarding` line and also serves it at <http://127.0.0.1:4040/api/tunnels>:

```
Forwarding    https://abc123.ngrok-free.app -> http://localhost:3000
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ this
```

Take the **origin only** — no path, no trailing slash. cloudflared prints its `https://….trycloudflare.com` address the same way.

**4. Put it in `back-end/.env.development`:**

```env
TELEGRAM_CALLBACK_ORIGIN="https://abc123.ngrok-free.app"
```

**5. Register the webhook:**

```bash
cd back-end
npm run telegram:webhook
```

It prints which bot it is talking to, registers `https://…/webhooks/telegram/platform`, and then prints what Telegram now holds.

**6. Send the bot a message** from your own Telegram account (open `https://t.me/<your_bot_username>`, press **Start**). The API log shows:

```
[TelegramInboundService] Telegram update 123456 received on "platform" (kinds: message) — not yet routed
```

That line is the whole chain working. Nothing answers yet — routing is phase 2 of `docs/future-features/telegram-channel.md`.

## When the ngrok URL changes

It changes on every restart of a free tunnel. Two steps, in this order:

```bash
# 1. edit back-end/.env.development → TELEGRAM_CALLBACK_ORIGIN=<the new https URL>
# 2. re-register
cd back-end && npm run telegram:webhook
```

Restarting the API is **not** required, in Docker or natively. The script reads `.env.development` itself, and nothing in the running API reads the callback origin today — only the script does. (When phase 3 registers a shop's bot from the vendor screen, the API will read it, and a container restart will start to matter.)

Registration is not a startup side effect on purpose: booting the API must never silently repoint a bot that other people may be using.

## Checking and undoing

```bash
npm run telegram:webhook -- --info      # print what Telegram holds; change nothing
npm run telegram:webhook -- --delete    # unsubscribe the bot entirely
```

`--info` is the first thing to run when nothing arrives. Its `last error` line is Telegram reporting why *it* could not deliver, which separates the failures cleanly:

| `last error` | What it means |
|---|---|
| (none) and `pending updates 0` | Working. |
| `Connection refused` / `Failed to connect` | Tunnel is up, the API is not. Start it (`npm run start:dev`, or `docker compose up -d api`). |
| `404 Not Found` | Both up, wrong path — the origin probably has a path in it. |
| `Wrong response … 401` | Not possible here: the receiver answers 200 to everything, a bad secret included. |
| `SSL error` / nothing registered | The origin is not HTTPS, or is on a port Telegram rejects. |

**One environment, read by two things.** `ConfigModule` reads `.env.development.local`, then `.env.development`, then `.env`, and `scripts/telegram-webhook.ts` loads the same three in the same order. It originally used `import 'dotenv/config'`, which reads `.env` **alone** — so a `TELEGRAM_CALLBACK_ORIGIN` written to `.env.development` was invisible to it and the script reported the variable as unset while the file plainly held it. The confusion was the mild half: had `APP_SECRET` differed between the two files, registration would have succeeded and our own receiver would then have rejected every delivery.

If `--info` shows the right URL and the API log stays silent, the secret is mismatched: the receiver rejects and still answers 200 (by design — a 4xx would make Telegram retry and then throttle). The API log shows `Rejected Telegram webhook for "platform"`. Both sides derive that secret from `APP_SECRET`, so this means the script and the API read different environments.

## What exists today

Only the boundary: the receiver verifies the per-bot secret with a length-checked `timingSafeEqual`, answers **200 to everything**, and logs the update's *kinds* — never `chat.id`, never the message text. Parsing, the private-chat filter, `update_id` de-duplication and routing to the two bot queues are phase 2.

The slug is `platform` and the secret is derived from `APP_SECRET`, both in `back-end/src/telegram/platform/platform-webhook.ts`. Phase 3 replaces them with a stored `webhook_slug` and an encrypted `webhook_secret` per bot; the routing sentinel is the only part meant to survive.

**The slug in the path is deliberately not the bot token**, which Telegram's own documentation suggests. A token in a URL is a full credential in every reverse-proxy log and every error trace.

## Files this touches

| File | Role |
|---|---|
| `back-end/.env.development` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CALLBACK_ORIGIN` — gitignored |
| `back-end/scripts/telegram-webhook.ts` | register / `--info` / `--delete` |
| `back-end/src/telegram/inbound/` | the receiver |
| `back-end/src/telegram/platform/platform-webhook.ts` | slug and derived secret |
| `back-end/src/integrations/provider-registry.ts` | `webhook_base_url` on the Telegram provider |
