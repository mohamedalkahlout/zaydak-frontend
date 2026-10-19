import { gql } from "@apollo/client"

/**
 * AI product-image generation ops (Replicate-backed on the server). The
 * mutation enqueues an async job and returns a QUEUED generation; the client
 * polls `aiImageGeneration` until it reaches a terminal status, then stages
 * the picked results into the product gallery via the normal save bar.
 */

export type ImageGenMode =
  | "TEXT_TO_IMAGE"
  | "IMAGE_TO_IMAGE"
  | "EDIT"
  | "BACKGROUND_REMOVE"
  | "UPSCALE"

export type ImageGenStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "MODERATED_OUT"
  | "CANCELED"

export interface AiImageResult {
  id: string
  attachment_id: string
  url: string
  thumbnail?: string | null
  selected: boolean
}

export interface AiImageGeneration {
  id: string
  status: ImageGenStatus
  mode: ImageGenMode
  model: string
  prompt: string
  cost_cents: number
  error?: string | null
  /**
   * Shot registry id when this row came from an Enhance Studio run. Null for
   * `generateProductImage` and for rows predating the shot registry.
   */
  shot?: string | null
  results: AiImageResult[]
  created_at: string
}

const GENERATION_FIELDS = gql`
  fragment AiImageGenerationFields on AiImageGenerationEntry {
    id
    status
    mode
    model
    prompt
    cost_cents
    error
    shot
    created_at
    results {
      id
      attachment_id
      url
      thumbnail
      selected
    }
  }
`

export const GENERATE_PRODUCT_IMAGE = gql`
  ${GENERATION_FIELDS}
  mutation GenerateProductImage($input: GenerateImageInput!) {
    generateProductImage(input: $input) {
      success
      data {
        ...AiImageGenerationFields
      }
    }
  }
`

export interface GenerateImageInput {
  prompt: string
  mode?: ImageGenMode
  model?: string
  count?: number
  aspectRatio?: string
  /** Reference images, subject first; a one-reference model reads [0]. */
  referenceAttachmentIds?: string[]
  productId?: string
  /**
   * A line of text drawn onto each finished image by the server, never sent to
   * the model. Moderated before anything is spent; a refusal is
   * `AI_IMAGE_PROMPT_REJECTED` on the `caption` field.
   */
  caption?: string
}

export interface GenerateImageResponse {
  generateProductImage: { success: boolean; data?: AiImageGeneration | null }
}

export const GET_AI_IMAGE_GENERATION = gql`
  ${GENERATION_FIELDS}
  query AiImageGeneration($id: String!) {
    aiImageGeneration(id: $id) {
      success
      data {
        ...AiImageGenerationFields
      }
    }
  }
`

export interface AiImageGenerationResponse {
  aiImageGeneration: { success: boolean; data?: AiImageGeneration | null }
}

export const SELECT_AI_IMAGE_RESULTS = gql`
  mutation SelectAiImageResults($generationId: String!, $resultIds: [String!]!) {
    selectAiImageResults(generationId: $generationId, resultIds: $resultIds) {
      success
      data {
        id
        selected
      }
    }
  }
`

export const CANCEL_IMAGE_GENERATION = gql`
  mutation CancelImageGeneration($id: String!) {
    cancelImageGeneration(id: $id) {
      success
    }
  }
`

/** A generation reached a terminal state (nothing more to poll). */
export function isTerminal(status: ImageGenStatus): boolean {
  return (
    status === "SUCCEEDED" ||
    status === "FAILED" ||
    status === "MODERATED_OUT" ||
    status === "CANCELED"
  )
}
