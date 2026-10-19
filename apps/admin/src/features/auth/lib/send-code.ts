import { useMutation } from "@apollo/client/react"

import { FORGET_PASSWORD, REQUEST_RESET_CODE, SEND_OTP_CODE } from "../api"
import { codeLengthFrom } from "../validations"
import { SEND_OTP_CODE_LEGACY, withLegacyFallback } from "./legacy-code-length"

/** A code that went out, and how many boxes to draw for it. */
export interface CodeSent {
  success: boolean
  /** 4 to 8, or 6 when the server did not say. */
  codeLength: number
}

/**
 * `sendOtpCode` for the sign-in-by-code screen. The answer carries the length
 * the code step draws, so codes set to four digits get four boxes and an
 * auto-submit on the fourth. Errors are thrown as they arrive, for the screen
 * to branch on `error_code`.
 */
export function useSendOtpCode() {
  const [send, { loading }] = useMutation(SEND_OTP_CODE)
  const [sendLegacy, { loading: legacyLoading }] =
    useMutation(SEND_OTP_CODE_LEGACY)

  const run = (identifier: string): Promise<CodeSent> => {
    const variables = { input: { identifier } }
    return withLegacyFallback<CodeSent>(
      async () => {
        const { data } = await send({ variables })
        return {
          success: data?.sendOtpCode?.success === true,
          codeLength: codeLengthFrom(data?.sendOtpCode?.data?.code_length),
        }
      },
      async () => {
        const { data } = await sendLegacy({ variables })
        return {
          success: data?.sendOtpCode?.success === true,
          codeLength: codeLengthFrom(undefined),
        }
      },
    )
  }

  return [run, { loading: loading || legacyLoading }] as const
}

/** `forgetPassword` for the forgot-password and reset-code screens. */
export function useForgetPassword() {
  const [send, { loading }] = useMutation(REQUEST_RESET_CODE)
  // The pre-`code_length` selection — see `legacy-code-length.ts`.
  const [sendLegacy, { loading: legacyLoading }] = useMutation(FORGET_PASSWORD)

  const run = (identifier: string): Promise<CodeSent> => {
    const variables = { input: { identifier } }
    return withLegacyFallback<CodeSent>(
      async () => {
        const { data } = await send({ variables })
        return {
          success: data?.forgetPassword?.success === true,
          codeLength: codeLengthFrom(data?.forgetPassword?.data?.code_length),
        }
      },
      async () => {
        const { data } = await sendLegacy({ variables })
        return {
          success: data?.forgetPassword?.success === true,
          codeLength: codeLengthFrom(undefined),
        }
      },
    )
  }

  return [run, { loading: loading || legacyLoading }] as const
}

/**
 * Where the forgot-password screen sends the reader once the code is out. The
 * length rides in the URL so the reset screen draws the right boxes on a
 * reload too; `resetCodeLength` reads it back.
 */
export function resetPasswordHref(identifier: string, codeLength: number) {
  const params = new URLSearchParams({
    identifier,
    code_length: String(codeLengthFrom(codeLength)),
  })
  return `/reset-password?${params.toString()}`
}

/** The reset screen's code length, from the `code_length` its URL carries. */
export function resetCodeLength(searchParams: {
  get(name: string): string | null
}) {
  const raw = searchParams.get("code_length")
  return codeLengthFrom(raw === null || raw === "" ? undefined : Number(raw))
}
