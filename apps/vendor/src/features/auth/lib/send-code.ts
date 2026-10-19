import { useMutation } from "@apollo/client/react"

import { FORGET_PASSWORD, SEND_OTP_CODE } from "../api"
import type { ForgetPasswordResponse, SendOtpResponse } from "../types"
import { codeLengthFrom } from "../validations/auth"
import {
  FORGET_PASSWORD_LEGACY,
  SEND_OTP_CODE_LEGACY,
  withLegacyFallback,
} from "./legacy-code-length"

/** A code that went out, and how many boxes to draw for it. */
export interface CodeSent {
  success: boolean
  /** 4 to 8, or 6 when the server did not say. */
  codeLength: number
}

/**
 * `sendOtpCode` for the code sign-in screen. The answer carries the length the
 * code pane draws, so an admin who sets codes to four digits gets four boxes
 * and an auto-submit on the fourth. Errors are thrown as they arrive, for the
 * screen to branch on `error_code`.
 */
export function useSendOtpCode() {
  const [send, { loading }] = useMutation<SendOtpResponse>(SEND_OTP_CODE)
  const [sendLegacy, { loading: legacyLoading }] =
    useMutation<SendOtpResponse>(SEND_OTP_CODE_LEGACY)

  const run = async (identifier: string): Promise<CodeSent> => {
    const variables = { input: { identifier } }
    const { data } = await withLegacyFallback(
      () => send({ variables }),
      () => sendLegacy({ variables }),
    )
    return {
      success: data?.sendOtpCode?.success === true,
      codeLength: codeLengthFrom(data?.sendOtpCode?.data?.code_length),
    }
  }

  return [run, { loading: loading || legacyLoading }] as const
}

/** `forgetPassword` for the forgot-password and reset-code screens. */
export function useForgetPassword() {
  const [send, { loading }] =
    useMutation<ForgetPasswordResponse>(FORGET_PASSWORD)
  const [sendLegacy, { loading: legacyLoading }] =
    useMutation<ForgetPasswordResponse>(FORGET_PASSWORD_LEGACY)

  const run = async (identifier: string): Promise<CodeSent> => {
    const variables = { input: { identifier } }
    const { data } = await withLegacyFallback(
      () => send({ variables }),
      () => sendLegacy({ variables }),
    )
    return {
      success: data?.forgetPassword?.success === true,
      codeLength: codeLengthFrom(data?.forgetPassword?.data?.code_length),
    }
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
export function resetCodeLength(searchParams: { get(name: string): string | null }) {
  const raw = searchParams.get("code_length")
  return codeLengthFrom(raw === null || raw === "" ? undefined : Number(raw))
}
