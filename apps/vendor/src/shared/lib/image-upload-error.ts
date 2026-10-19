/**
 * The rich-text image node reports failures as English `Error` messages.
 * Classifying them here keeps the editor's toast on the message catalogue.
 */
export type ImageUploadError =
  | { id: "noFile" }
  | { id: "tooLarge"; size: number }
  | { id: "tooMany"; limit: number }
  | { id: "cancelled" }
  | { id: "failed" }

export function classifyImageUploadError(message: string): ImageUploadError {
  if (
    message === "No file provided" ||
    message === "No file selected" ||
    message === "No files to upload"
  ) {
    return { id: "noFile" }
  }
  if (message.startsWith("File size exceeds")) {
    const size = Number(message.match(/\((\d+)MB\)/)?.[1] ?? 5)
    return { id: "tooLarge", size }
  }
  if (message.startsWith("Maximum ")) {
    const limit = Number(message.match(/Maximum (\d+)/)?.[1] ?? 1)
    return { id: "tooMany", limit }
  }
  if (message === "Upload cancelled") return { id: "cancelled" }
  return { id: "failed" }
}
