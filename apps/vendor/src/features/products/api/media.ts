import { gql } from "@apollo/client"

/**
 * Lists the active shop's uploaded attachments so the media manager's
 * "Select existing" picker can reuse files without re-uploading. Backed by
 * the `attachments` GraphQL query (JWT + X-SHOP scoped to the shop).
 */
export const GET_ATTACHMENTS = gql`
  query Attachments($context: String, $page: Int, $limit: Int) {
    attachments(context: $context, page: $page, limit: $limit) {
      success
      data {
        id
        url
        thumbnail
        mime_type
        original_name
        created_at
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

export interface AttachmentEntry {
  id: string
  url: string
  thumbnail?: string | null
  mime_type: string
  original_name: string
  created_at: string
}

export interface AttachmentsQueryResponse {
  attachments: {
    success: boolean
    data: AttachmentEntry[]
    meta: { total: number; page: number; limit: number; total_pages: number }
  }
}

/** Single attachment by id — editor Information panel (name, size, date). */
export const GET_ATTACHMENT = gql`
  query Attachment($id: String!) {
    attachment(id: $id) {
      success
      data {
        id
        original_name
        mime_type
        size
        url
        thumbnail
        created_at
      }
    }
  }
`

export interface AttachmentByIdResponse {
  attachment: {
    success: boolean
    data?:
      | (AttachmentEntry & { original_name: string; mime_type: string; size: number })
      | null
  }
}

/** How many products reference an asset URL — the editor's "Used in" panel. */
export const GET_ATTACHMENT_USAGE = gql`
  query AttachmentUsage($url: String!) {
    attachmentUsage(url: $url) {
      success
      count
      product_names
    }
  }
`

export interface AttachmentUsageResponse {
  attachmentUsage: {
    success: boolean
    count: number
    product_names: string[]
  }
}

/** Vision-model alt text for an image (localhost-safe: server inlines base64). */
export const SUGGEST_ATTACHMENT_ALT = gql`
  mutation SuggestAttachmentAlt($url: String!, $lang: String) {
    suggestAttachmentAlt(url: $url, lang: $lang) {
      success
      alt
    }
  }
`

export interface SuggestAltResponse {
  suggestAttachmentAlt: { success: boolean; alt: string }
}

/** Rename an attachment's display name (editor Information panel). */
export const RENAME_ATTACHMENT = gql`
  mutation RenameAttachment($id: String!, $name: String!) {
    renameAttachment(id: $id, name: $name) {
      success
      data {
        id
        original_name
      }
    }
  }
`

export interface RenameAttachmentResponse {
  renameAttachment: {
    success: boolean
    data?: { id: string; original_name: string } | null
  }
}
