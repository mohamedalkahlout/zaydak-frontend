"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useTranslations } from "next-intl"

/**
 * Minimal Web Speech API wrapper.
 *
 * SpeechRecognition is Chrome/Edge/Safari-only (vendor-prefixed in
 * Safari/Chrome as `webkitSpeechRecognition`). We detect availability
 * up-front and expose `supported` so the UI can hide the mic button
 * on Firefox instead of showing a dead control.
 *
 * Behaviour:
 *  - `start(lang)` begins continuous recognition. `interimTranscript`
 *    reflects in-progress words, `finalTranscript` the committed ones.
 *  - `stop()` ends the session. `finalTranscript` is what we surface
 *    to the textarea.
 *  - Auto-stop on end-event fallback in case the browser shuts it down
 *    (e.g., too long silence).
 */

type MinimalSpeechRecognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: {
    resultIndex: number
    results: ArrayLike<{
      isFinal: boolean
      0: { transcript: string }
    }>
  }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => MinimalSpeechRecognition

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// Speech-recognition availability never changes at runtime, so the
// useSyncExternalStore subscription is a no-op.
const subscribeSpeechSupport = () => () => {}

export interface UseVoiceInputResult {
  supported: boolean
  listening: boolean
  interimTranscript: string
  finalTranscript: string
  error: string | null
  start: (lang?: string) => void
  stop: () => void
}

export function useVoiceInput(): UseVoiceInputResult {
  const t = useTranslations("aiChat.voiceInput")
  // Hydration-safe capability detection: the server has no SpeechRecognition,
  // so report `false` during SSR and the first client render, then switch to
  // the real value. Avoids a server/client markup mismatch for the mic button.
  const supported = useSyncExternalStore(
    subscribeSpeechSupport,
    () => getSpeechRecognition() !== null,
    () => false,
  )
  const [listening, setListening] = useState(false)
  const [interimTranscript, setInterim] = useState("")
  const [finalTranscript, setFinal] = useState("")
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null)

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(
    (lang?: string) => {
      const Ctor = getSpeechRecognition()
      if (!Ctor) {
        setError(t("notSupported"))
        return
      }
      if (listening) return

      setError(null)
      setInterim("")
      setFinal("")

      const rec = new Ctor()
      rec.lang = lang ?? "en-US"
      rec.interimResults = true
      rec.continuous = true

      rec.onresult = (event) => {
        let interim = ""
        let final = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0].transcript
          if (result.isFinal) final += transcript
          else interim += transcript
        }
        if (final) setFinal((prev) => prev + final)
        setInterim(interim)
      }
      rec.onerror = (event) => {
        setError(event.error || t("failed"))
      }
      rec.onend = () => {
        setListening(false)
        setInterim("")
      }

      try {
        rec.start()
        recognitionRef.current = rec
        setListening(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : t("startFailed"))
      }
    },
    [listening, t],
  )

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  return {
    supported,
    listening,
    interimTranscript,
    finalTranscript,
    error,
    start,
    stop,
  }
}
