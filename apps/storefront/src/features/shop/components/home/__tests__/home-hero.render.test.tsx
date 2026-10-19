import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'

import messages from '@/shared/messages/en.json'
import { buildHeroShowcase } from '../lib/hero-showcase'
import type { HeroShowcaseItem } from '../lib/hero-showcase'

/**
 * The hero is centred type over a product marquee. What needs pinning is not
 * a screenshot of the band — it is that the shop's name is the page heading,
 * that real product frames are links into the catalogue, and that a shop with
 * no photographed products still gets a finished opening rather than an empty
 * strip (the cover / bundled pad path).
 *
 * `useShop` throws outside a `ShopProvider`, so the context is mocked the same
 * way `shop-footer.render.test.tsx` does. `next/image` is stubbed so "which
 * photograph is on screen?" stays readable in jsdom.
 */
const shopState = vi.hoisted(() => ({
  slug: 'acme',
  base: '/acme',
  mode: 'path' as const,
  shop: null as Record<string, unknown> | null,
  missing: false,
  currency: 'USD' as string | null,
}))

vi.mock('../../../shop-context', () => ({ useShop: () => shopState }))

vi.mock('@/shared/components/app-image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

import { HomeHero } from '../home-hero'

const SAMPLE: HeroShowcaseItem[] = [
  {
    id: '1',
    src: '/p1.jpg',
    alt: 'Clay mug',
    href: '/acme/products/clay-mug',
  },
  {
    id: '2',
    src: '/p2.jpg',
    alt: 'Linen tote',
    href: '/acme/products/linen-tote',
  },
  {
    id: '3',
    src: '/p3.jpg',
    alt: 'Oak tray',
    href: '/acme/products/oak-tray',
  },
]

function renderHero(
  shop: Record<string, unknown> | null = null,
  opts: {
    products?: number
    collections?: number
    tags?: number
    slug?: string
    showcase?: HeroShowcaseItem[]
  } = {},
) {
  shopState.shop = shop
  shopState.slug = opts.slug ?? 'acme'
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <HomeHero
        productCount={opts.products ?? 12}
        collectionCount={opts.collections ?? 0}
        tagCount={opts.tags ?? 0}
        showcase={opts.showcase ?? SAMPLE}
      />
    </NextIntlClientProvider>,
  )
}

describe('HomeHero', () => {
  it("makes the shop name reachable as the page's heading", () => {
    renderHero({ name: 'Acme Supply' })
    expect(
      screen.getByRole('heading', { name: 'Acme Supply', level: 1 }),
    ).toBeTruthy()
  })

  it('falls back to the slug before the shop query resolves', () => {
    renderHero(null)
    expect(screen.getByRole('heading', { name: 'acme', level: 1 })).toBeTruthy()
  })

  it('links showcase frames into the products they show', () => {
    renderHero({ name: 'Acme Supply' })
    // The loop renders each frame twice for a seamless track; the duplicate
    // copy is aria-hidden / alt-stripped, so the named link is the live one.
    const link = screen.getAllByRole('link').find(
      (el) => el.getAttribute('href') === '/acme/products/clay-mug',
    )
    expect(link).toBeTruthy()
    expect(link?.querySelector('img')?.getAttribute('alt')).toBe('Clay mug')
  })

  it('keeps decorative pads unlinked and silent', () => {
    const pads: HeroShowcaseItem[] = [
      { id: 'pad-0', src: '/cover.jpg', alt: '', href: null },
      { id: 'pad-1', src: '/cover.jpg', alt: '', href: null },
      { id: 'pad-2', src: '/cover.jpg', alt: '', href: null },
    ]
    const { container } = renderHero({ name: 'Acme Supply' }, { showcase: pads })

    expect(
      [...container.querySelectorAll('a')].every(
        (a) => !a.getAttribute('href')?.includes('/products/'),
      ),
    ).toBe(true)
    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBeGreaterThan(0)
    expect([...imgs].every((img) => img.getAttribute('alt') === '')).toBe(true)
  })

  it('points the primary CTA at the catalogue', () => {
    renderHero({ name: 'Acme Supply' })
    // `Button` with `render={<Link />}` exposes as a button in the a11y tree
    // in this stack; the href still lives on the anchor.
    const cta = screen.getByText('Shop now').closest('a')
    expect(cta?.getAttribute('href')).toBe('/acme/products')
  })
})

describe('buildHeroShowcase', () => {
  it('prefers real product frames and dedupes by image URL', () => {
    const products = [
      {
        id: 'a',
        slug: 'mug',
        name: { en: 'Mug' },
        image: { original: '/mug.jpg', thumbnail: '/mug-t.jpg' },
      },
      {
        id: 'b',
        slug: 'mug-2',
        name: { en: 'Mug twin' },
        image: { original: '/mug.jpg', thumbnail: '/mug-t.jpg' },
      },
      {
        id: 'c',
        slug: 'tote',
        name: { en: 'Tote' },
        image: { original: '/tote.jpg' },
      },
      {
        id: 'd',
        slug: 'tray',
        name: { en: 'Tray' },
        image: { original: '/tray.jpg' },
      },
    ] as never

    const items = buildHeroShowcase(products, {
      base: '/acme',
      locale: 'en',
      cover: null,
    })

    expect(items.filter((i) => i.href)).toHaveLength(3)
    expect(items[0]?.href).toBe('/acme/products/mug')
    expect(items.map((i) => i.src)).toEqual(
      expect.arrayContaining(['/mug-t.jpg', '/tote.jpg', '/tray.jpg']),
    )
  })

  it('pads with the cover when the catalogue has too few photos', () => {
    const items = buildHeroShowcase([], {
      base: '/acme',
      locale: 'en',
      cover: '/cover.jpg',
    })

    expect(items.length).toBeGreaterThanOrEqual(3)
    expect(items.every((i) => i.href === null && i.src === '/cover.jpg')).toBe(
      true,
    )
  })
})
