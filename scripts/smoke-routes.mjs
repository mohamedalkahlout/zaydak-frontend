#!/usr/bin/env node
/**
 * Render every authed route once and fail on a server error.
 *
 * This exists because of a specific outage: dropping `SidebarProvider` from the
 * admin's integrations screen left `SiteHeader` calling `useSidebar()`, which
 * throws without a provider — a 500 on every authed request to a whole section.
 * `next build`, `typecheck` and the unit suite were all green, because those
 * routes are dynamic and nothing renders them until a real request arrives.
 *
 * What it asserts is deliberately narrow: **the route does not 5xx**. A 200 and
 * a 307 to /login are both fine — the guard redirecting is correct behaviour,
 * and this is not a test of authentication. A stub cookie is supplied because
 * both guards only check that the cookie *exists* and never decode the JWT, so
 * it is enough to get past them and actually render the page. The page's own
 * data fetching will fail against no API; that is expected and is not a 5xx,
 * because the screens handle a failed query. A component that throws during
 * render is what this catches.
 *
 * Usage: node scripts/smoke-routes.mjs <baseUrl> <cookieName> <route...>
 */

const [, , baseUrl, cookieName, ...routes] = process.argv;

if (!baseUrl || !cookieName || routes.length === 0) {
  console.error(
    'usage: smoke-routes.mjs <baseUrl> <cookieName> <route> [route...]',
  );
  process.exit(2);
}

const COOKIE = `${cookieName}=smoke-test-not-a-real-token`;
const TIMEOUT_MS = 30_000;

/** Wait for the server to accept connections before asserting anything. */
async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(2_000) });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }
  return false;
}

if (!(await waitForServer(baseUrl))) {
  console.error(`✗ server at ${baseUrl} never came up`);
  process.exit(1);
}

let failed = 0;

for (const route of routes) {
  const url = new URL(route, baseUrl).toString();
  let status;
  try {
    const res = await fetch(url, {
      headers: { cookie: COOKIE },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = res.status;
  } catch (err) {
    console.error(`✗ ${route} — request failed: ${err.message}`);
    failed++;
    continue;
  }

  if (status >= 500) {
    console.error(`✗ ${route} — ${status}`);
    failed++;
  } else {
    console.log(`✓ ${route} — ${status}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} route(s) returned a server error.`);
  process.exit(1);
}

console.log(`\nAll ${routes.length} route(s) rendered without a server error.`);
