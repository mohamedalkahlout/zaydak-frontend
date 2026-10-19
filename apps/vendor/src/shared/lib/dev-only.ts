import { notFound } from "next/navigation"

/**
 * Gate for developer playground routes — call it from the route's `layout.tsx`.
 *
 * These routes sit outside `proxy.ts`'s matcher on purpose, so they open with no
 * session. That is what makes them useful locally and what makes them a hole in
 * production: the guard never sees them, so anything they render or expose is
 * public to anyone who guesses the path.
 *
 * A layout is the right place for this rather than the page, because the pages
 * are client components and this check has to run on the server. `NODE_ENV` is
 * `production` during `next build`, so the route resolves to the 404 at build
 * time rather than shipping a live playground.
 */
export function assertDevOnly(): void {
  if (process.env.NODE_ENV === "production") notFound()
}
