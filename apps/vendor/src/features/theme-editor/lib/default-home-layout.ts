import type { StoreLayoutDocument } from "../types"

/** Merchant-intent mock of the storefront homepage currently shipping. */
export const DEFAULT_HOME_LAYOUT: StoreLayoutDocument = {
  template: "home",
  version: 1,
  sections: {
    sec_hero_01: {
      id: "sec_hero_01",
      type: "hero",
      disabled: false,
      settings: {
        showStats: true,
        showBrowseCta: true,
        showNewCta: true,
      },
    },
    sec_facets_01: {
      id: "sec_facets_01",
      type: "facets",
      disabled: false,
      settings: {
        showSearch: true,
        showAllChip: true,
        collectionIds: [],
        tagIds: [],
      },
    },
    sec_trending_01: {
      id: "sec_trending_01",
      type: "product_rail",
      disabled: false,
      settings: {
        source: "trending",
        limit: 10,
        showHeading: true,
        showViewAll: false,
        layout: "slider",
      },
    },
    sec_popular_01: {
      id: "sec_popular_01",
      type: "product_rail",
      disabled: false,
      settings: {
        source: "most_viewed",
        limit: 10,
        showHeading: true,
        showViewAll: true,
        layout: "slider",
      },
    },
    sec_collections_01: {
      id: "sec_collections_01",
      type: "collection_bento",
      disabled: false,
      settings: {
        collectionIds: [],
      },
    },
    sec_ticker_01: {
      id: "sec_ticker_01",
      type: "collection_ticker",
      disabled: false,
      settings: {
        collectionIds: [],
        tagIds: [],
      },
    },
    sec_deals_01: {
      id: "sec_deals_01",
      type: "product_rail",
      disabled: false,
      settings: {
        source: "markdowns",
        limit: 10,
        showHeading: true,
        showViewAll: false,
        layout: "slider",
      },
    },
    sec_newest_01: {
      id: "sec_newest_01",
      type: "product_grid",
      disabled: false,
      settings: {
        source: "newest",
        limit: 8,
        showHeading: true,
        showViewAll: true,
      },
    },
    sec_values_01: {
      id: "sec_values_01",
      type: "values",
      disabled: false,
      settings: {},
    },
    sec_story_01: {
      id: "sec_story_01",
      type: "story",
      disabled: false,
      settings: {
        showDetails: true,
      },
    },
  },
  order: [
    "sec_hero_01",
    "sec_facets_01",
    "sec_trending_01",
    "sec_popular_01",
    "sec_collections_01",
    "sec_ticker_01",
    "sec_deals_01",
    "sec_newest_01",
    "sec_values_01",
    "sec_story_01",
  ],
}
