/**
 * Minimal SSE frame parser for the vendor-agent stream.
 *
 * Reads chunks of text out of a ReadableStreamDefaultReader and yields
 * parsed events. We write our own instead of using `EventSource` because
 * EventSource only supports GET — our endpoint is POST with a JSON body
 * + auth headers, so we use fetch-streaming.
 *
 * Frame format emitted by the server matches the WHATWG SSE spec:
 *   event: <type>
 *   data: <json>
 *   (blank line separates frames)
 */
export interface SseEvent {
  type: string
  data: unknown
}

export async function* readSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<SseEvent, void, void> {
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      // Flush any trailing partial frame — usually none, but be safe.
      if (buffer.trim()) {
        const evt = parseFrame(buffer.trim())
        if (evt) yield evt
      }
      return
    }

    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by a blank line (\n\n). Walk the buffer,
    // peel complete frames off the front, keep the tail for next chunk.
    let sepIndex: number
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawFrame = buffer.slice(0, sepIndex)
      buffer = buffer.slice(sepIndex + 2)
      const evt = parseFrame(rawFrame)
      if (evt) yield evt
    }
  }
}

function parseFrame(frame: string): SseEvent | null {
  let type = "message"
  const dataLines: string[] = []
  for (const line of frame.split("\n")) {
    if (!line || line.startsWith(":")) continue
    const colon = line.indexOf(":")
    if (colon === -1) continue
    const field = line.slice(0, colon)
    const value = line.slice(colon + 1).replace(/^ /, "")
    if (field === "event") type = value
    else if (field === "data") dataLines.push(value)
  }
  if (dataLines.length === 0) return null
  const dataStr = dataLines.join("\n")
  try {
    return { type, data: JSON.parse(dataStr) }
  } catch {
    return { type, data: dataStr }
  }
}
