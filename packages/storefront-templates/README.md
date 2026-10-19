# @repo/storefront-templates

Presentation for the storefront templates: doughn, drip, rail, hullo, personne, and jurat.
Markup, CSS, motion, fonts, and bundled art. A just-in-time package: it ships
raw `.ts` / `.tsx` / `.css`, so each consuming app lists it in
`transpilePackages`.

What belongs here: a template that receives products, cart lines, and copy as
props (or the existing callback contract). Sample catalogues the theme preview
and the empty-shop fallback share (`content.ts`, `data.ts`, `catalog.ts`).
Checkout frames, which paint a session the app fills in.

What does not: Apollo, Zustand, `next-intl`, `@/features/*`, cart mutations,
`X-SHOP`, checkout route selection, or composition-to-catalogue mappers.
Those stay in `apps/storefront`. The template picker, theme preview routes,
and theme editor stay in `apps/vendor`.

```ts
import { DripTemplate } from "@repo/storefront-templates/drip"
import { DoughnCheckoutFrame } from "@repo/storefront-templates/doughn/checkout"
```

Images inside a template are plain `<img>` of bundled art (or a URL the app
passed in). The package does not import either app's `AppImage`. Jurat's
recordings are imported `.mp3` modules. Turbopack does not know that
extension, so vendor and storefront register `*.mp3` as a turbopack `asset`
(the import is the file URL).

`next/font` runs in the app that compiles the page (vendor preview and the
storefront), and the template receives the resulting class names or family
variables. Calling it from this package makes Turbopack fail to resolve
`@vercel/turbopack-next/internal/font/google/font`.
