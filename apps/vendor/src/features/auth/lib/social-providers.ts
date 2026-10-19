/**
 * Public client IDs for Google / Apple Sign-In on the vendor dashboard.
 * Buttons render only when set; back-end must list the same ids in
 * `GOOGLE_CLIENT_IDS` / `APPLE_CLIENT_IDS`.
 *
 * Google Cloud Console → Authorized JavaScript origins must include both
 * `http://localhost` and `http://localhost:3001`.
 */

export function googleClientId(): string | null {
  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
  return id || null
}

export function appleClientId(): string | null {
  const id = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID?.trim()
  return id || null
}

export function socialAuthConfigured(): boolean {
  return Boolean(googleClientId() || appleClientId())
}

type GoogleTokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void
}

type GoogleAccounts = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        callback: (response: {
          access_token?: string
          error?: string
          error_description?: string
        }) => void
        error_callback?: (err: { type?: string; message?: string }) => void
      }) => GoogleTokenClient
    }
  }
}

type AppleIDAuth = {
  auth: {
    init: (config: {
      clientId: string
      scope: string
      redirectURI: string
      usePopup: boolean
    }) => void
    signIn: () => Promise<{
      authorization: { id_token: string }
      user?: {
        email?: string
        name?: { firstName?: string; lastName?: string }
      }
    }>
  }
}

declare global {
  interface Window {
    google?: GoogleAccounts
    AppleID?: AppleIDAuth
  }
}

function loadScript(src: string, id: string): Promise<void> {
  if (typeof document === "undefined") return Promise.reject(new Error("SSR"))
  const existing = document.getElementById(id)
  if (existing) {
    return existing.getAttribute("data-ready") === "1"
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener("load", () => resolve())
          existing.addEventListener("error", () =>
            reject(new Error(`Failed to load ${src}`)),
          )
        })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.id = id
    script.src = src
    script.async = true
    script.onload = () => {
      script.setAttribute("data-ready", "1")
      resolve()
    }
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

export async function loadGoogleIdentity(): Promise<GoogleAccounts> {
  await loadScript("https://accounts.google.com/gsi/client", "google-gsi")
  if (!window.google) throw new Error("Google Identity Services unavailable")
  return window.google
}

export async function loadAppleSignIn(): Promise<AppleIDAuth> {
  await loadScript(
    "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js",
    "apple-signin",
  )
  if (!window.AppleID) throw new Error("Apple Sign-In unavailable")
  return window.AppleID
}

/** GIS popup token client — avoids FedCM One Tap NetworkError on localhost. */
export async function requestGoogleAccessToken(
  clientId: string,
): Promise<string> {
  const google = await loadGoogleIdentity()

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (err?: Error, token?: string) => {
      if (settled) return
      settled = true
      if (err || !token) reject(err ?? new Error("Google sign-in cancelled"))
      else resolve(token)
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile",
        callback: (response) => {
          if (response.error) {
            finish(
              new Error(
                response.error_description ||
                  response.error ||
                  "Google sign-in failed",
              ),
            )
            return
          }
          if (response.access_token) finish(undefined, response.access_token)
          else finish(new Error("Google sign-in returned no access token"))
        },
        error_callback: (err) => {
          finish(
            new Error(err.message || err.type || "Google sign-in cancelled"),
          )
        },
      })
      client.requestAccessToken({ prompt: "select_account" })
    } catch (err) {
      finish(err instanceof Error ? err : new Error("Google sign-in failed"))
    }
  })
}

export async function requestAppleIdToken(clientId: string): Promise<{
  idToken: string
  name?: string
}> {
  const AppleID = await loadAppleSignIn()
  AppleID.auth.init({
    clientId,
    scope: "name email",
    redirectURI: window.location.origin,
    usePopup: true,
  })

  const result = await AppleID.auth.signIn()
  const idToken = result.authorization?.id_token
  if (!idToken) throw new Error("Apple sign-in returned no id_token")

  const parts = result.user?.name
  const name = [parts?.firstName, parts?.lastName].filter(Boolean).join(" ")

  return { idToken, name: name || undefined }
}
