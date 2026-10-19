import { gql } from '@apollo/client';

/**
 * Settings → Instagram. Every operation is scoped to the shop in `X-SHOP` on
 * the server; none takes a shop, an account or a redirect URL.
 */

export const SHOP_INSTAGRAM_ACCOUNT_FIELDS = gql`
  fragment ShopInstagramAccountFields on ShopInstagramAccountType {
    available
    connected
    status
    instagram_username
    instagram_user_id
    last_connected_at
    disconnected_at
    last_health_check_at
    last_ok_at
    last_error
    automation_enabled
    ai_enabled
    ai_orders_enabled
    comment_replies_enabled
    comment_reply_mode
    comment_keywords
    ai_instructions
    human_takeover_on_reply
  }
`;

export const GET_MY_SHOP_INSTAGRAM_ACCOUNT = gql`
  query MyShopInstagramAccount {
    myShopInstagramAccount {
      ...ShopInstagramAccountFields
    }
  }
  ${SHOP_INSTAGRAM_ACCOUNT_FIELDS}
`;

/** Returns Zernio's Instagram authorization URL; the browser goes there next. */
export const CONNECT_SHOP_INSTAGRAM_ACCOUNT = gql`
  mutation ConnectShopInstagramAccount {
    connectShopInstagramAccount {
      authorization_url
    }
  }
`;

export const DISCONNECT_SHOP_INSTAGRAM_ACCOUNT = gql`
  mutation DisconnectShopInstagramAccount {
    disconnectShopInstagramAccount {
      ...ShopInstagramAccountFields
    }
  }
  ${SHOP_INSTAGRAM_ACCOUNT_FIELDS}
`;

export const CHECK_SHOP_INSTAGRAM_HEALTH = gql`
  mutation CheckShopInstagramHealth {
    checkShopInstagramHealth {
      ...ShopInstagramAccountFields
    }
  }
  ${SHOP_INSTAGRAM_ACCOUNT_FIELDS}
`;

export const UPDATE_SHOP_INSTAGRAM_SETTINGS = gql`
  mutation UpdateShopInstagramSettings($input: UpdateShopInstagramSettingsInput!) {
    updateShopInstagramSettings(input: $input) {
      ...ShopInstagramAccountFields
    }
  }
  ${SHOP_INSTAGRAM_ACCOUNT_FIELDS}
`;

export const MAP_INSTAGRAM_MEDIA_TO_PRODUCT = gql`
  mutation MapInstagramMediaToProduct($input: MapInstagramMediaInput!) {
    mapInstagramMediaToProduct(input: $input)
  }
`;

export const UNMAP_INSTAGRAM_MEDIA = gql`
  mutation UnmapInstagramMedia($input: UnmapInstagramMediaInput!) {
    unmapInstagramMedia(input: $input)
  }
`;

/** The account's 25 most recent posts, live from Instagram, with their product links. */
export const GET_MY_SHOP_INSTAGRAM_POSTS = gql`
  query MyShopInstagramPosts {
    myShopInstagramPosts {
      id
      caption
      media_type
      media_url
      permalink
      created_at
      like_count
      comment_count
      linked_product {
        id
        name
        slug
        price_cents
        sale_price_cents
        image_url
        quantity
        in_stock
      }
    }
  }
`;

/** Last 30 days of DMs and comments, from the server's delivery ledger. */
export const GET_MY_SHOP_INSTAGRAM_STATS = gql`
  query MyShopInstagramStats {
    myShopInstagramStats {
      window_days
      conversations
      messages_received
      messages_answered
      comments_answered
      linked_posts
      reply_rate
    }
  }
`;
