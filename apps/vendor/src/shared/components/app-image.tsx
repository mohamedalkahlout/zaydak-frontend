import NextImage, { type ImageProps } from "next/image"

/**
 * `next/image` with one behaviour added: a host `next.config.ts` does not list
 * is rendered directly by the browser instead of throwing.
 *
 * The default loader THROWS on an unlisted host, and in the App Router a throw
 * during render is caught by the nearest `error.tsx` — one imported product
 * thumbnail on `burst.shopifycdn.com` turned the whole of
 * `/store/[shopSlug]/products/**` into "Failed to load products".
 *
 * A catalogue image URL is not ours to choose: the Shopify CSV importer stores
 * whatever `Image Src` the file carried (the sample template's Burst CDN, a
 * merchant's old domain, anything), so "a host we did not list" is a normal
 * input rather than a misconfiguration. Import `Image` from here rather than
 * from `next/image` — the ESLint rule in `eslint.config.mjs` enforces it — and
 * an unknown host costs the optimizer, not the screen.
 *
 * The real fix is re-hosting imported images onto our own CDN at import time;
 * it is tracked in TODO.md.
 */

/**
 * Mirrors `images.remotePatterns` in `next.config.ts`. It has to: `/_next/image`
 * checks that list server-side, so a host allowed here and not there is a 400
 * and a broken tile. Add a host in both places or in neither.
 */
const OPTIMIZABLE_HOSTS = [
  /^placehold\.co$/,
  /(^|\.)b-cdn\.net$/,
  /^cdn\.zaydak\.com$/,
]

/** Whether `/_next/image` will accept this src, or the browser should fetch it itself. */
export function canOptimize(src: ImageProps["src"]): boolean {
  // A static import (`StaticImageData`) is bundled with the app.
  if (typeof src !== "string") return true
  // Our own `public/` assets; `data:`/`blob:` are handled by `next/image` itself.
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) return true
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return false
  }
  return OPTIMIZABLE_HOSTS.some((host) => host.test(url.hostname))
}

export default function AppImage({ src, unoptimized, ...props }: ImageProps) {
  return <NextImage src={src} unoptimized={unoptimized ?? !canOptimize(src)} {...props} />
}
