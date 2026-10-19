import { gql } from "@apollo/client"

export const GET_PRODUCT_BY_SLUG = gql`
  query Product($slug: String!) {
    product(slug: $slug) {
      success
      data {
        id
        name
        slug
        description
        seo_title
        seo_description
        sku
        barcode
        price_cents
        sale_price_cents
        cost_per_item_cents
        min_price_cents
        max_price_cents
        quantity
        sold_quantity
        in_stock
        track_quantity
        continue_selling_when_out_of_stock
        is_digital
        requires_shipping
        weight_grams
        weight_unit_display
        length_mm
        width_mm
        height_mm
        package_id
        hs_code
        country_of_origin
        image
        gallery
        video
        target_audience
        brand
        type_name
        ai_keywords
        views
        status
        product_type
        sale_type
        version
        min_bid_price_cents
        max_bid_price_cents
        max_percentage_bps
        shop_id
        system_category_id
        system_category {
          id
          slug
          path
          name
          level
        }
        shop {
          id
          name
          slug
        }
        tags {
          id
          name
          slug
        }
        collections {
          id
          name
          slug
        }
        variation_options {
          id
          title
          position
          price_cents
          sale_price_cents
          cost_per_item_cents
          sku
          quantity
          sold_quantity
          is_disable
          track_quantity
          options
          image
        }
        option_definitions {
          name
          position
          values {
            label
          }
        }
        attributes {
          key
          name
          type
          value
          display_value
          is_outdated
          definition_version
          unit
        }
        created_at
        updated_at
      }
    }
  }
`

export const GET_PRODUCTS = gql`
  query Products($filters: ProductFilterInput) {
    products(filters: $filters) {
      success
      data {
        id
        name
        slug
        price_cents
        sale_price_cents
        min_price_cents
        max_price_cents
        quantity
        in_stock
        image
        status
        product_type
        sale_type
        views
        sku
        brand
        track_quantity
        system_category {
          id
          slug
          path
          name
          level
        }
        collections {
          id
          name
          slug
        }
        variation_options {
          id
          title
          price_cents
          quantity
        }
        created_at
        updated_at
      }
      meta {
        total
        page
        limit
        total_pages
      }
    }
  }
`

/**
 * The types and vendors this shop already uses — what the organization
 * pickers offer instead of an empty text box. Both fields are free text, and
 * showing what is already in the catalogue is what keeps three spellings of
 * one vendor from accumulating.
 */
export const GET_PRODUCT_ORGANIZATION_OPTIONS = gql`
  query ProductOrganizationOptions {
    productOrganizationOptions {
      success
      data {
        types
        vendors
      }
    }
  }
`

/**
 * The taxonomy nodes this shop's products are actually filed under, each with
 * its count. This is what the list's Category filter offers: the full
 * taxonomy is ~5500 nodes of which a shop uses a handful, and a picker
 * listing categories nothing in the shop belongs to can only return nothing.
 */
export const GET_PRODUCT_CATEGORIES = gql`
  query ProductCategories($locale: String!) {
    productCategories(locale: $locale) {
      success
      data {
        id
        slug
        path
        parent_id
        name
        level
        product_count
      }
      meta {
        total
      }
    }
  }
`

/**
 * Flat list of all system-category nodes (PRODUCTS.md §16.2). The tree is
 * ~5500 nodes but static per-locale — fetch once, search client-side.
 * Cached aggressively; version-hashed server-side so it only refetches
 * when the underlying taxonomy actually changes.
 */
export const GET_SYSTEM_CATEGORIES_FLAT = gql`
  query SystemCategoriesFlat($locale: String) {
    systemCategoriesFlat(locale: $locale) {
      success
      data {
        id
        slug
        path
        parent_id
        name
        level
      }
      meta {
        total
      }
    }
  }
`

export const GET_SYSTEM_CATEGORY_TREE = gql`
  query SystemCategoryTree($locale: String, $rootId: String) {
    systemCategoryTree(locale: $locale, rootId: $rootId) {
      success
      data {
        id
        slug
        path
        parent_id
        name
        level
        children {
          id
          slug
          path
          parent_id
          name
          level
          children {
            id
            slug
            path
            parent_id
            name
            level
          }
        }
      }
    }
  }
`

export const GET_SYSTEM_CATEGORY = gql`
  query SystemCategory($id: String!, $locale: String) {
    systemCategory(id: $id, locale: $locale) {
      success
      data {
        id
        slug
        path
        parent_id
        name
        level
      }
    }
  }
`

/**
 * Effective attribute schema for a system category (PRODUCTS.md §16.4).
 * The response unions the category's own definitions with every ancestor
 * definition (extend-only), sorted by `sort_order`. Re-fetch whenever
 * the user changes `system_category_id` on the product form — the
 * response determines what metafield inputs are rendered.
 */
export const GET_CATEGORY_ATTRIBUTES = gql`
  query CategoryAttributes($systemCategoryId: String!, $locale: String) {
    categoryAttributes(systemCategoryId: $systemCategoryId, locale: $locale) {
      success
      data {
        id
        key
        name
        description
        type
        required
        filterable
        sort_order
        unit
        version
        system_category_id
        options {
          id
          value
          label
          sort_order
        }
      }
    }
  }
`
