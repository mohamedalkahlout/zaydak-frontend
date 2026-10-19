// Vendor-scoped collections (vendor/docs/features/collections.md).

import { gql } from "@apollo/client"

const COLLECTION_FIELDS = `
  id
  shop_id
  type
  name
  slug
  image
  description
  seo_title
  seo_description
  sort_order
  sort
  is_published
  rules
  rules_version
  product_count
  created_at
  updated_at
`

const ITEM_FIELDS = `
  id
  name
  slug
  image
  price_cents
  sale_price_cents
  status
  quantity
  in_stock
  pinned
  position
`

export const GET_SHOP_COLLECTIONS = gql`
  query ShopCollections($page: Int, $limit: Int, $search: String) {
    collections(page: $page, limit: $limit, search: $search) {
      success
      data {
        ${COLLECTION_FIELDS}
      }
      meta {
        total
        page
        total_pages
      }
    }
  }
`

export const GET_SHOP_COLLECTION_BY_ID = gql`
  query ShopCollection($id: String!) {
    collection(id: $id) {
      success
      data {
        ${COLLECTION_FIELDS}
        # Resolved per-collection, so it is asked for here and nowhere else.
        pinned_product_ids
      }
    }
  }
`

/** The saved collection's members, in its own sort order. */
export const GET_COLLECTION_ITEMS = gql`
  query CollectionItems($collection_id: String!, $page: Int, $limit: Int) {
    collectionItems(collection_id: $collection_id, page: $page, limit: $limit) {
      success
      data {
        ${ITEM_FIELDS}
      }
      meta {
        total
        page
        total_pages
      }
    }
  }
`

/**
 * What the staged rules WOULD select. Nothing is written, so the editor can
 * call it on every condition change and show the vendor what a rule brings in
 * before they commit to it.
 */
export const PREVIEW_COLLECTION = gql`
  query PreviewCollection($input: CollectionPreviewInput!) {
    previewCollection(input: $input) {
      success
      data {
        ${ITEM_FIELDS}
      }
      meta {
        total
        page
        total_pages
      }
    }
  }
`
