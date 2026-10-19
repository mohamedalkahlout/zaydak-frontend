import fs from "node:fs"
import path from "node:path"
import { expect, test as setup, type APIRequestContext } from "playwright/test"
import {
  BASE_URL,
  GRAPHQL_URL,
  SHOP_FILE,
  STORAGE_STATE,
  VENDOR_EMAIL,
  vendorPassword,
} from "./env"

/**
 * One sign-in for the whole run, plus the one piece of seed-dependent data the
 * specs cannot invent: a shop that actually holds products.
 *
 * The sign-in goes through the real `/login` form rather than POSTing the
 * `login` mutation and planting cookies. Planting them is faster and was the
 * first version, but it encodes this app's cookie split (`refresh_token`
 * httpOnly, `access_token` readable) into the test suite — so the day
 * `/api/auth/session` changes, the suite keeps passing against a session shape
 * the app no longer issues. Driving the form costs one page load and has no
 * opinion about how the session is stored.
 *
 * The shop is *discovered* rather than named because `myShops` for the seeded
 * vendor is mostly empty scratch shops (eleven of them on the machine this was
 * written on, two with any products), and `/store` does not necessarily land on
 * one of the two. An empty shop is not a failure of the composer — the picker
 * correctly says "No matches" — but it is a spec that can never assert
 * anything, which is the worst kind of green.
 */

setup("sign in and pick a shop with products", async ({ page, request }) => {
  setup.setTimeout(180_000)
  const { value: password, source } = vendorPassword()
  setup.info().annotations.push({ type: "password source", description: source })

  await page.goto(`${BASE_URL}/login`)
  await page.locator("#identifier").fill(VENDOR_EMAIL)
  await page.locator("#password").fill(password)
  await page.locator("button[type=submit]").click()

  // The form pushes to `/store`, which then resolves the vendor's default shop.
  await page.waitForURL(/\/store(\/|$)/, { timeout: 150_000 })

  const token = (await page.context().cookies()).find(
    (c) => c.name === "access_token",
  )?.value
  expect(
    token,
    `signed in as ${VENDOR_EMAIL} but no access_token cookie was set ` +
      `(password source: ${source})`,
  ).toBeTruthy()

  const shop = await pickShopWithProducts(request, token!)
  setup
    .info()
    .annotations.push({ type: "shop", description: JSON.stringify(shop) })

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true })
  fs.writeFileSync(SHOP_FILE, JSON.stringify(shop, null, 2))
  await page.context().storageState({ path: STORAGE_STATE })
})

async function pickShopWithProducts(
  request: APIRequestContext,
  token: string,
): Promise<{ slug: string; productCount: number }> {
  const auth = { authorization: `Bearer ${token}` }
  const call = async (
    query: string,
    variables: Record<string, unknown>,
    headers: Record<string, string> = {},
  ) => {
    const res = await request.post(GRAPHQL_URL, {
      headers: { "content-type": "application/json", ...auth, ...headers },
      data: { query, variables },
    })
    return res.json()
  }

  const shops = await call(
    `query { myShops { data { slug is_active } } }`,
    {},
  )
  const rows: { slug: string; is_active: boolean }[] =
    shops?.data?.myShops?.data ?? []
  expect(
    rows.length,
    `myShops returned nothing for ${VENDOR_EMAIL}: ${JSON.stringify(shops?.errors)}`,
  ).toBeGreaterThan(0)

  // Active shops first: an inactive one still answers `products`, but the
  // dashboard it renders is a different screen and the panel may not be on it.
  const ordered = [...rows].sort(
    (a, b) => Number(b.is_active) - Number(a.is_active),
  )

  for (const shop of ordered) {
    const products = await call(
      `query($f: ProductFilterInput) { products(filters: $f) { data { id } } }`,
      { f: { limit: 8 } },
      { "X-SHOP": shop.slug },
    )
    const count: number = products?.data?.products?.data?.length ?? 0
    if (count > 0) return { slug: shop.slug, productCount: count }
  }

  throw new Error(
    `None of ${rows.length} shop(s) owned by ${VENDOR_EMAIL} has a product. ` +
      `The @-mention picker has nothing to offer, so the composer specs ` +
      `cannot insert a token. Seed one: cd back-end && npm run seed.`,
  )
}
