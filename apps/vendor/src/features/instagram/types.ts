export type InstagramAiMode = 'AUTO' | 'AI_ASSISTED' | 'HUMAN_ONLY';

/** `shop_instagram_accounts.status` on the server. */
export type InstagramConnectionStatus =
  | 'pending'
  | 'connected'
  | 'disconnected'
  | 'needs_reconnect';

export type InstagramCommentReplyMode =
  | 'DISABLED'
  | 'PUBLIC'
  | 'PRIVATE'
  | 'PUBLIC_AND_PRIVATE';

/** `ShopInstagramAccountType` — connected through Zernio; carries no credential. */
export interface ShopInstagramAccount {
  /** Whether this deployment can connect Instagram at all. */
  available: boolean;
  connected: boolean;
  status: InstagramConnectionStatus | string;
  instagram_username: string | null;
  instagram_user_id: string | null;
  last_connected_at?: string | null;
  disconnected_at?: string | null;
  last_health_check_at?: string | null;
  last_ok_at?: string | null;
  last_error?: string | null;
  automation_enabled: boolean;
  ai_enabled: boolean;
  ai_orders_enabled: boolean;
  comment_replies_enabled: boolean;
  comment_reply_mode: InstagramCommentReplyMode;
  comment_keywords: string[];
  ai_instructions: string | null;
  human_takeover_on_reply: boolean;
  ai_mode?: InstagramAiMode;
}

export interface LinkedProductInfo {
  id: string;
  name: string;
  price_cents: number;
  sale_price_cents?: number | null;
  image?: string | null;
  sku?: string | null;
  slug?: string | null;
  in_stock?: boolean;
  quantity?: number;
}

/** One post as the posts grid shows it. */
export interface InstagramPostItem {
  id: string;
  /** As Instagram reports it: `IMAGE`, `VIDEO`, `CAROUSEL_ALBUM`… */
  media_type: string;
  /** Empty when Instagram sent no picture. */
  media_url: string;
  permalink: string;
  caption: string;
  /** ISO date, or empty. */
  timestamp: string;
  like_count?: number | null;
  comments_count?: number | null;
  linked_product?: LinkedProductInfo | null;
}

/** `InstagramLinkedProductType` as the server sends it. */
export interface InstagramLinkedProductResult {
  id: string;
  /** `{ en, ar }`, as products store it. */
  name: unknown;
  slug: string;
  price_cents: number;
  sale_price_cents: number | null;
  image_url: string | null;
  quantity: number;
  in_stock: boolean;
}

/** `InstagramPostType` as the server sends it. */
export interface InstagramPostResult {
  id: string;
  caption: string;
  media_type: string;
  media_url: string | null;
  permalink: string | null;
  created_at: string | null;
  like_count: number | null;
  comment_count: number | null;
  linked_product: InstagramLinkedProductResult | null;
}

export interface MyShopInstagramPostsResult {
  myShopInstagramPosts: InstagramPostResult[];
}

export interface InstagramStats {
  window_days: number;
  conversations: number;
  messages_received: number;
  messages_answered: number;
  comments_answered: number;
  linked_posts: number;
  /** Percent; null when nothing was received. */
  reply_rate: number | null;
}

export interface MyShopInstagramStatsResult {
  myShopInstagramStats: InstagramStats;
}

export interface UnmapInstagramMediaResult {
  unmapInstagramMedia: boolean;
}

export interface ShopInstagramMediaMapping {
  id: string;
  instagram_media_id: string;
  product_id: string;
  media_permalink?: string | null;
  caption_snippet?: string | null;
  created_at?: string;
}

export interface MyShopInstagramAccountResult {
  myShopInstagramAccount: ShopInstagramAccount;
}

export interface ConnectShopInstagramAccountResult {
  connectShopInstagramAccount: {
    authorization_url: string;
  };
}

export interface DisconnectShopInstagramAccountResult {
  disconnectShopInstagramAccount: ShopInstagramAccount;
}

export interface CheckShopInstagramHealthResult {
  checkShopInstagramHealth: ShopInstagramAccount;
}

export interface UpdateShopInstagramSettingsResult {
  updateShopInstagramSettings: ShopInstagramAccount;
}

export interface MapInstagramMediaToProductResult {
  mapInstagramMediaToProduct: boolean;
}

export interface UpdateShopInstagramSettingsInput {
  automation_enabled?: boolean;
  ai_enabled?: boolean;
  ai_orders_enabled?: boolean;
  comment_replies_enabled?: boolean;
  comment_reply_mode?: InstagramCommentReplyMode;
  comment_keywords?: string[];
  ai_instructions?: string | null;
  human_takeover_on_reply?: boolean;
}

export interface MapInstagramMediaInput {
  media_id: string;
  product_id: string;
  keywords?: string[];
}
