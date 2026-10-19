import { describe, expect, it } from "vitest"
import { classifyImageUploadError } from "../image-upload-error"

describe("classifyImageUploadError", () => {
  it("maps the node's English messages onto catalogue ids", () => {
    expect(classifyImageUploadError("No file selected").id).toBe("noFile")
    expect(classifyImageUploadError("No files to upload").id).toBe("noFile")
    expect(classifyImageUploadError("Upload cancelled").id).toBe("cancelled")
    expect(classifyImageUploadError("Upload failed").id).toBe("failed")
    expect(classifyImageUploadError("File size exceeds maximum allowed (5MB)")).toEqual({
      id: "tooLarge",
      size: 5,
    })
    expect(classifyImageUploadError("Maximum 3 files allowed")).toEqual({
      id: "tooMany",
      limit: 3,
    })
  })
})
