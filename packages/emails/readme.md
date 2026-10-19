# @repo/emails — Zaydak transactional templates

React Email templates for platform mail (OTP, welcome, verification, cart
recovery, back-in-stock, staff notifications). OTP, welcome, verification and
cart-recovery carry an English half then an Arabic half, because the auth
flow does not yet know the recipient's language. NestJS renders them through
the exported helpers in `src/render.ts`; this package is also the live preview.

## Preview

From the repo root:

```bash
npm install
npx turbo run dev --filter=@repo/emails
```

Or:

```bash
cd packages/emails
npm run dev
```

Open [http://localhost:3005](http://localhost:3005).

## Templates

| File | Job |
|------|-----|
| `emails/otp.tsx` | Sign-in / OTP code (EN + AR) |
| `emails/welcome.tsx` | Post-registration welcome (EN + AR) |
| `emails/email-verification.tsx` | Confirm email address (EN + AR) |
| `emails/cart-recovery.tsx` | Abandoned cart (EN + AR) |
| `emails/back-in-stock.tsx` | Stock notification |
| `emails/notification.tsx` | Generic staff sentence |
| `emails/contact-reply.tsx` | A merchant's reply to a storefront contact-form sender, from the shop inbox. One language per email (`lang`, `dir="rtl"` for Arabic), the reply escaped with its line breaks kept, a link to the shop's contact page, no quote of the customer's message, and a footer saying why it arrived — plus, when `reportUrl` is passed (a `mailto:` or `https:` href; anything else is dropped), a "report this email" line under it, drawn through `EmailShell`'s `footerExtra` |

`EmailShell` passes `dir` and `lang` to `<Body>` as well as `<Html>`: React
Email's `Body` otherwise writes `dir="ltr"` on its own element, which laid a
one-language Arabic email out left-to-right. Callers that pass neither still get
ltr.

After adding or changing a template, run `npm run build` here before the
back-end's tests or an image build. The back-end's `ensure-emails-built.cjs`
skips the build whenever `dist` exists, so a stale `dist` fails only at send
time.

Brand colours match the storefront ink + teal (`#111827` / `#00C2A8`) so Gmail
reads as the same product, not a purple SaaS blast.

## NestJS

```ts
import { renderOtpEmail } from '@repo/emails';

const { html, text } = await renderOtpEmail({ code: '482917', expiresIn: 5 });
```

`back-end` depends on this package via `file:../packages/emails` and builds it
in `prebuild` before `nest build`.
