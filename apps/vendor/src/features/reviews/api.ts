import { gql } from "@apollo/client"

/**
 * The vendor review queue.
 *
 * Deliberately NOT the storefront's `reviews` query: that one is public and
 * returns bare ids, so a merchant screen built on it shows a column of cuids.
 * `shopReviews` is ownership-gated (X-SHOP + `ShopOwnershipGuard`) and resolves
 * the reviewer, the product and the photo URLs server-side.
 */
export const GET_SHOP_REVIEWS = gql`
  query ShopReviews(
    $page: Int
    $limit: Int
    $rating: Int
    $product_id: String
    $search: String
    $sort: ShopReviewSort
  ) {
    shopReviews(
      page: $page
      limit: $limit
      rating: $rating
      product_id: $product_id
      search: $search
      sort: $sort
    ) {
      success
      data {
        id
        product_id
        customer_id
        order_id
        comment
        rating
        photo_urls
        positive_feedbacks_count
        negative_feedbacks_count
        abusive_reports_count
        created_at
        updated_at
        product {
          id
          name
          slug
          image
        }
        customer {
          id
          name
          email
          avatar
        }
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

/** Headline counts — independent of the list's filters, so it is its own query. */
export const GET_SHOP_REVIEWS_SUMMARY = gql`
  query ShopReviewsSummary {
    shopReviewsSummary {
      success
      data {
        total
        average_rating
        distribution {
          rating
          count
        }
        with_photos
        last_30_days
        reported
      }
    }
  }
`

/**
 * Flags a review for platform moderation.
 *
 * This is the merchant's only write on a review, and that is on purpose:
 * `deleteReview` is gated on `manage_all_shops`, which no vendor holds. A shop
 * that could delete its own one-star reviews would make every rating on the
 * platform meaningless — so the vendor reports, and an admin decides.
 */
export const REPORT_REVIEW = gql`
  mutation ReportReview($input: CreateAbusiveReportInput!) {
    createAbusiveReport(input: $input) {
      success
      message
    }
  }
`
