# @repo/fonts

**Nothing imports this package.** It is the archive for the licensed webfonts
and their paperwork, not a build input.

The platform's Arabic face is **Tajawal**, loaded by `next/font/google` in each
app's `app/layout.tsx` and bound to `--font-tajawal`; `globals.css` applies it
under `html[lang="ar"]`. `next/font` downloads and self-hosts the woff2 at
build time, so there is no request to Google at runtime, no `public/` copy and
no sync step. Latin UI is the SF system stack (`--font-sf`, declared once in
`packages/ui/src/styles/tokens.css`) — Apple does not license San Francisco for
redistribution, so English reads as SF on Apple devices and as the platform UI
font elsewhere.

## What is still here, and why

```
packages/fonts/
├── assets/ibm-plex-sans-arabic/   # 5 woff2 (SIL OFL) — the face before Tajawal
├── assets/Thmanyah-Font-Family/   # 15 woff2 — the consoles' face before that
├── fonts.css                      # the @font-face block those two needed
├── sync.mjs                       # copied assets into an app's public/fonts
├── IBM-Plex-Sans-Arabic-OFL.txt   # SIL Open Font License
├── LICENSE.pdf                    # Thmanyah webfont grant
└── POLICY-ar.pdf
```

The Thmanyah faces are paid for and the grant is a document worth keeping, so
the package stays rather than being deleted. `fonts.css` and `sync.mjs` are the
old mechanism: a package's `public/` is never served and Next resolves a
root-absolute `/fonts/...` only against the app's own `public/`, so the bytes
had to be copied in by `predev`/`prebuild` and by a turbo task for the cache-hit
case. All of that is gone from the apps — `next/font` needs none of it.

`apps/*/public/fonts/` stays gitignored as a guard against a stray local copy
being committed again. Faces still sitting there in a working tree are
leftovers from that era and nothing reads them.

## If you change the Arabic face

It is one edit per app, in `app/layout.tsx` (the `Tajawal(...)` call) and
`app/globals.css` (the `html[lang="ar"]` block). Keep the three identical —
they were one face, then two, and a vendor reading their shop in one typeface
and the dashboard that manages it in another is what that cost.
