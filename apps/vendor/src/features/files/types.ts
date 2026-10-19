/** Types for the Content > Files feature (backed by the `attachments` API). */

export type FileSortField = "date" | "name" | "size"
export type FileSortOrder = "asc" | "desc"
export type FileTypeFacet = "image" | "video" | "pdf"
export type FileSizePreset = "sm" | "md" | "lg"
export type FilesView = "grid" | "list"

export interface FileEntry {
  id: string
  filename: string
  original_name: string
  mime_type: string
  size: number
  url: string
  thumbnail?: string | null
  alt?: string | null
  context: string
  created_at: string
  updated_at: string
}

export interface FilesResponse {
  attachments: {
    success: boolean
    data: FileEntry[]
    meta: { total: number; page: number; limit: number; total_pages: number }
  }
}

export interface FileResponse {
  attachment: {
    success: boolean
    data?: FileEntry | null
  }
}

export interface FileUsageResponse {
  attachmentUsage: {
    success: boolean
    count: number
    product_names: string[]
  }
}

export interface UpdateFileResponse {
  updateAttachment: {
    success: boolean
    data?: { id: string; original_name: string; alt?: string | null } | null
  }
}

export interface DeleteFileResponse {
  deleteAttachment: { success: boolean }
}

export interface ReplaceFileFromExistingResponse {
  replaceAttachmentFromExisting: {
    success: boolean
    data?: Pick<FileEntry, "id" | "original_name" | "alt" | "context" | "updated_at"> | null
  }
}

export interface DeleteFilesResponse {
  deleteAttachments: { success: boolean }
}

export interface SuggestFileAltResponse {
  suggestAttachmentAlt: { success: boolean; alt: string }
}
