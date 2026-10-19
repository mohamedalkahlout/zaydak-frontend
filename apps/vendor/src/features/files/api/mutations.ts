import { gql } from "@apollo/client"

/** Promote an existing attachment and move the original's references to it. */
export const REPLACE_FILE_FROM_EXISTING = gql`
  mutation ReplaceAttachmentFromExisting($id: String!, $replacementId: String!) {
    replaceAttachmentFromExisting(id: $id, replacementId: $replacementId) {
      success
      data {
        id
        original_name
        alt
        context
        updated_at
      }
    }
  }
`

/** Update a file's display name and/or alt text (detail panel save bar). */
export const UPDATE_FILE = gql`
  mutation UpdateAttachmentFile($id: String!, $name: String, $alt: String) {
    updateAttachment(id: $id, name: $name, alt: $alt) {
      success
      data {
        id
        original_name
        alt
      }
    }
  }
`

/** Soft-delete a single file (detail panel / row action). */
export const DELETE_FILE = gql`
  mutation DeleteAttachmentFile($id: String!) {
    deleteAttachment(id: $id) {
      success
    }
  }
`

/** Bulk soft-delete for the multi-select toolbar. */
export const DELETE_FILES = gql`
  mutation DeleteAttachmentFiles($ids: [String!]!) {
    deleteAttachments(ids: $ids) {
      success
    }
  }
`

/**
 * Run a set of AI shots against one image: one output image per shot.
 *
 * Takes no prompt — the wording is composed server-side from the picked style +
 * closed options, so the client contract stays attachment + presets. Returns one
 * QUEUED generation per shot, each polled with `aiImageGeneration` (see
 * `useEnhanceFile`). Results are NEW attachments; the original is untouched.
 *
 * `'enhance'` is a shot like any other — not implied and not privileged in the
 * response — so read each row's `shot` field rather than assuming `data[0]`.
 *
 * `requestId` is required and must be stable across retries of the *same*
 * submit: a run can fire several paid images at once, so a double-click without
 * it buys a second set. Re-sending the same id returns the first run's rows.
 */
export const ENHANCE_IMAGE_SHOTS = gql`
  mutation EnhanceImageShots($input: EnhanceImageShotsInput!) {
    enhanceImageShots(input: $input) {
      success
      data {
        id
        shot
        status
        error
        results {
          id
          attachment_id
          url
          thumbnail
          selected
        }
      }
    }
  }
`

/**
 * Stop one still-running generation.
 *
 * Worth spelling out what this costs and what it gives back, because the two
 * are not symmetric. The **platform's** daily spend ledger books at
 * reservation time and has no release path, so cancelling never un-spends
 * that. The **shop's monthly image quota** is counted by excluding FAILED /
 * CANCELED / MODERATED_OUT rows (`getMonthlyUsage`), so cancelling *does*
 * hand the vendor their quota slot back.
 *
 * That asymmetry is the whole rule for when to call this: cancelling a run
 * that is genuinely stuck reclaims a slot that would otherwise be burned on
 * nothing, while cancelling one that is about to land trades a real image for
 * a slot — strictly worse for the vendor. The backend guards the second case
 * (the claim only matches QUEUED/RUNNING, so a generation that has already
 * succeeded is left alone and this resolves `success: false`), but the client
 * still only fires it where abandonment is unambiguous.
 */
export const CANCEL_ENHANCE_GENERATION = gql`
  mutation CancelEnhanceGeneration($id: String!) {
    cancelImageGeneration(id: $id) {
      success
    }
  }
`

/** Mirror of the backend `EnhanceImageOptionsInput` (all closed vocabularies). */
export interface EnhanceOptionsInput {
  style?: string
  backgroundHex?: string
  lightDirection?: string
  lightSoftness?: string
  aspectRatio?: string
  occasion?: string
  /** Free-text scene description for the `custom` style. */
  customScene?: string
  /** Design id for a shot that offers one; a shot without designs ignores it. */
  socialDesign?: string
}

/** Mirror of the backend `EnhanceImageShotsInput`. */
export interface EnhanceShotsInput {
  attachmentId: string
  requestId: string
  shots: string[]
  productId?: string
  options?: EnhanceOptionsInput
  /** How many variations per shot (1, 4, or 8). */
  variationCount?: number
  /**
   * Extra views of the same product, beyond `attachmentId`.
   *
   * The subject always leads the list server-side, so these are additional
   * angles the model conditions on rather than alternative subjects. Capped one
   * below the model ceiling because the subject holds the first slot.
   */
  referenceAttachmentIds?: string[]
  /**
   * Words the server draws onto the output of every shot that
   * `accepts_caption`, and onto nothing else. A run-level field rather than a
   * member of `EnhanceOptionsInput` on purpose: presets store those options,
   * and a campaign line belongs to one run. Moderated server-side before any
   * spend; a refusal comes back as `AI_IMAGE_PROMPT_REJECTED` on `caption`.
   */
  caption?: string | null
}

/**
 * Save the panel's current configuration under a name, or overwrite one the
 * shop already owns by passing its `id`.
 *
 * Stores settings only — no source image and no reference images. A preset
 * outlives the product it was saved from, so carrying that product's extra
 * angles into the next shoot would attach the wrong item's photos to it.
 *
 * It cannot spend: this writes a row, and the vendor still presses the run CTA,
 * which is where the quota and the budget are gated. That is what makes saving
 * a preset with `variationCount: 8` safe — applying it fills the panel and the
 * cost footer immediately prices what the button would now cost.
 */
export const SAVE_ENHANCE_PRESET = gql`
  mutation SaveEnhancePreset($input: SaveEnhancePresetInput!) {
    saveEnhancePreset(input: $input) {
      success
      data {
        id
        name
      }
    }
  }
`

/** Delete one saved preset. Hard delete — its name becomes reusable at once. */
export const DELETE_ENHANCE_PRESET = gql`
  mutation DeleteEnhancePreset($id: String!) {
    deleteEnhancePreset(id: $id) {
      success
    }
  }
`

/** Mirror of the backend `SaveEnhancePresetInput`. */
export interface SaveEnhancePresetInput {
  /** Omit to create; supply to overwrite a preset this shop owns. */
  id?: string
  name: string
  shots: string[]
  options?: EnhanceOptionsInput
  variationCount?: number
}

/** Vision-model alt text suggestion for an image. */
export const SUGGEST_FILE_ALT = gql`
  mutation SuggestFileAlt($url: String!, $lang: String) {
    suggestAttachmentAlt(url: $url, lang: $lang) {
      success
      alt
    }
  }
`
