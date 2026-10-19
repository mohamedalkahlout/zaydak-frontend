import { HttpLink, type ApolloLink } from "@apollo/client";
import { SetContextLink } from "@apollo/client/link/context";
import { ErrorLink } from "@apollo/client/link/error";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { from, mergeMap, of } from "rxjs";
import {
  ACCESS_TOKEN_COOKIE,
  ACTIVE_SHOP_KEY,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
} from "@/shared/lib/auth/cookie-names";
import { translatorFor } from "@/shared/i18n/outside-react";
import type { Translate } from "@/shared/i18n/translator";
import { tunnelHeaders } from "./tunnel-headers";

export const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3000/graphql";

// Re-export so existing callers that imported these from `apollo/links` still
// resolve. New code should import from `shared/lib/auth/cookie-names`.
export {
  ACCESS_TOKEN_COOKIE as ACCESS_TOKEN_KEY,
  ACTIVE_SHOP_KEY,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
};

type HeaderContext = { headers?: Record<string, string> };

// Backend error_code values the frontend reacts to directly.
const AUTH_ERROR_CODES = new Set([
  "TOKEN_INVALID",
  "UNAUTHORIZED",
  "UNAUTHENTICATED",
  "AUTHENTICATION_REQUIRED",
]);
const RATE_LIMIT_CODES = new Set(["RATE_LIMIT_EXCEEDED", "TOO_MANY_REQUESTS"]);

/**
 * Turn the throttle guard's `retry_after_seconds=<n>` detail into words.
 * Returns null for anything else, so an older backend (or a rate limit from
 * somewhere that sends no detail) still gets the generic wording.
 *
 * `t` is scoped to `requestErrors.wait`; the plural rules live in the message,
 * which is what lets Arabic say "دقيقتين" rather than "2 دقائق".
 */
export function describeRetryAfter(
  detail: string | undefined,
  t: Translate,
): string | null {
  const seconds = Number(/^retry_after_seconds=(\d+)$/.exec(detail ?? "")?.[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return t("seconds", { count: seconds });
  return t("minutes", { count: Math.ceil(seconds / 60) });
}
// Forms render these field-level; suppress the generic toast.
const SILENT_CODES = new Set(["VALIDATION_ERROR"]);

/**
 * Show one of the `requestErrors.<key>` toasts. The error link has no
 * component to call `useTranslations` from, so the translator is built from
 * the page's own language (see `translatorFor`).
 */
function toastRequestError(key: string) {
  if (typeof window === "undefined") return;
  void Promise.all([import("sileo"), translatorFor("requestErrors")]).then(
    ([{ sileo }, t]) => {
      sileo.error({ title: t(`${key}.title`), description: t(`${key}.description`) });
    },
  );
}

// ── HTTP Link ────────────────────────────────────────

export function makeHttpLink() {
  return new HttpLink({ uri: GRAPHQL_URL, headers: tunnelHeaders(GRAPHQL_URL) });
}

// ── Auth Link ────────────────────────────────────────

export function makeAuthLink(getToken: () => string | null | undefined) {
  return new SetContextLink((prevContext) => {
    const { headers = {} } = prevContext as HeaderContext;
    // Honor explicit overrides from the caller (refresh mutations pass
    // an empty string to suppress the stale access token).
    if ("authorization" in headers) return { headers };
    const token = getToken();
    return {
      headers: {
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    };
  });
}

// ── Locale Link ──────────────────────────────────────
// Adds Accept-Language so backend can translate error messages/content.

export function makeLocaleLink(getLocale: () => string | null | undefined) {
  return new SetContextLink((prevContext) => {
    const locale = getLocale() || DEFAULT_LOCALE;
    const { headers } = prevContext as HeaderContext;
    return {
      headers: {
        ...headers,
        "accept-language": locale,
      },
    };
  });
}

// ── Shop Link ────────────────────────────────────────
// Injects X-SHOP header from the active-shop slug so backend scopes data
// to the selected store.

export function makeShopLink(getShopSlug: () => string | null | undefined) {
  return new SetContextLink((prevContext) => {
    const slug = getShopSlug();
    const { headers } = prevContext as HeaderContext;
    return {
      headers: {
        ...headers,
        ...(slug ? { "x-shop": slug } : {}),
      },
    };
  });
}

// ── Error Link ───────────────────────────────────────

// A backend outage makes every in-flight operation fail at once and keeps
// failing on each retry (the notifications poll, the SSE stream handshake,
// etc.). Logging + toasting each one floods the console; in dev the Next
// server resolves a source map per forwarded stack trace, and that unbounded
// work is what exhausts (OOMs) the Turbopack process. So the generic network
// error is emitted at most once per window, and operations that opt into
// `silentErrors` (background handshakes / non-fatal AI suggestions that own
// their own UI) skip console logging for both network and GraphQL errors.
const NETWORK_ERROR_TOAST_WINDOW_MS = 10_000;
let lastNetworkErrorAt = 0;

export function makeErrorLink() {
  return new ErrorLink(({ error, operation, forward }) => {
    const silent = operation.getContext().silentErrors === true;

    if (!CombinedGraphQLErrors.is(error)) {
      if (silent) return;

      const now = Date.now();
      if (now - lastNetworkErrorAt < NETWORK_ERROR_TOAST_WINDOW_MS) return;
      lastNetworkErrorAt = now;

      console.error(
        `[Network Error] ${error.message}`,
        `| operation: ${operation.operationName}`,
      );
      toastRequestError("networkError");
      return;
    }

    const first = error.errors[0];
    const extensions = (first?.extensions ?? {}) as {
      error_code?: string;
      code?: string;
      detail?: string;
    };
    const code = extensions.error_code ?? extensions.code;

    // Log every GraphQL error in dev for observability — unless the operation
    // opted into `silentErrors` (non-fatal background work that owns its own UI).
    //
    // The validation reasons are printed too, and that is the whole point of
    // this shape: a VALIDATION_ERROR's `message` is always the literal string
    // "Validation failed", so a log without them says an operation failed and
    // refuses to say why — while the server had already named the field, the
    // code and a sentence for a person to read.
    if (!silent) {
      for (const err of error.errors) {
        const ext = (err.extensions ?? {}) as {
          error_code?: string;
          validation_errors?: Array<{
            field?: string | null;
            code?: string | null;
            messages?: string[] | null;
          }> | null;
          detail?: string;
        };
        const reasons = (ext.validation_errors ?? [])
          .map(
            (v) =>
              `${v.field ?? "?"}: ${v.code ?? "?"} — ${(v.messages ?? []).join(" ")}`,
          )
          .join(" | ");
        console.error(
          `[GraphQL Error] ${err.message}`,
          `| operation: ${operation.operationName}`,
          `| path: ${err.path?.join(".")}`,
          `| code: ${ext.error_code}`,
          ...(reasons ? [`| why: ${reasons}`] : []),
          ...(ext.detail ? [`| detail: ${ext.detail}`] : []),
        );
      }
    }

    // Silent refresh + retry on expired access token.
    if (code === "TOKEN_EXPIRED" && typeof window !== "undefined") {
      return from(
        import("@/shared/lib/auth/refresh").then(({ refreshAccessToken }) =>
          refreshAccessToken(),
        ),
      ).pipe(
        mergeMap((newToken) => {
          if (!newToken) {
            void import("@/shared/lib/auth/session").then(({ forceLogout }) =>
              forceLogout({ redirectTo: "/login?expired=1" }),
            );
            return of();
          }
          // Re-issue the request with the fresh token in context.
          operation.setContext(({ headers = {} }) => ({
            headers: { ...headers, authorization: `Bearer ${newToken}` },
          }));
          return forward(operation);
        }),
      );
    }

    if (code === "TOKEN_REUSE_DETECTED" && typeof window !== "undefined") {
      void Promise.all([
        import("@/shared/lib/auth/session"),
        translatorFor("requestErrors"),
      ]).then(([{ forceLogout }, t]) =>
        forceLogout({
          title: t("suspiciousActivity.title"),
          description: t("suspiciousActivity.description"),
          redirectTo: "/login",
        }),
      );
      return;
    }

    const legacyAuthFailure =
      extensions.code === "UNAUTHENTICATED" ||
      extensions.code === "UNAUTHORIZED";

    if (
      (code && AUTH_ERROR_CODES.has(code)) ||
      (legacyAuthFailure && typeof window !== "undefined")
    ) {
      if (typeof window !== "undefined") {
        void import("@/shared/lib/auth/session").then(({ forceLogout }) =>
          forceLogout({ redirectTo: "/login?expired=1" }),
        );
      }
      return;
    }

    if (code && SILENT_CODES.has(code)) return;

    if (code === "ACCOUNT_LOCKED") {
      toastRequestError("accountLocked");
      return;
    }

    if (code === "OTP_LOCKED") {
      toastRequestError("otpLocked");
      return;
    }

    if (code === "OTP_COOLDOWN") {
      toastRequestError("otpCooldown");
      return;
    }

    if (code === "EMAIL_NOT_VERIFIED") {
      toastRequestError("emailNotVerified");
      return;
    }

    if (code && RATE_LIMIT_CODES.has(code)) {
      if (typeof window !== "undefined") {
        // The guard puts the real wait in `detail`. Without it this said
        // "a moment" for a fifteen-minute block, so people kept retrying —
        // which is exactly what the counter is measuring.
        void Promise.all([import("sileo"), translatorFor("requestErrors")]).then(
          ([{ sileo }, t]) => {
            const wait = describeRetryAfter(extensions.detail, (key, values) =>
              t(`wait.${key}`, values),
            );
            sileo.error({
              title: t("tooManyRequests.title"),
              description: wait
                ? t("tooManyRequests.descriptionWait", { wait })
                : t("tooManyRequests.description"),
            });
          },
        );
      }
      return;
    }

    if (typeof window !== "undefined") {
      void Promise.all([import("sileo"), translatorFor("requestErrors")]).then(
        ([{ sileo }, t]) => {
          // The API localises its own messages from `accept-language`.
          sileo.error({ title: first?.message || t("fallback") });
        },
      );
    }
  });
}

// ── Tracing Link ─────────────────────────────────────

export function makeTracingLink() {
  return new SetContextLink((prevContext) => {
    const { headers } = prevContext as HeaderContext;
    return {
      headers: {
        ...headers,
        "x-request-id": crypto.randomUUID(),
      },
    };
  });
}

// ── Compose ──────────────────────────────────────────

export function composeLinks(
  getToken: () => string | null | undefined,
  getShopSlug?: () => string | null | undefined,
  getLocale?: () => string | null | undefined,
): ApolloLink {
  const errorLink = makeErrorLink();
  const tracingLink = makeTracingLink();
  const authLink = makeAuthLink(getToken);
  const localeLink = makeLocaleLink(getLocale ?? (() => DEFAULT_LOCALE));
  const httpLink = makeHttpLink();

  let chain: ApolloLink = errorLink
    .concat(tracingLink)
    .concat(localeLink)
    .concat(authLink);
  if (getShopSlug) {
    chain = chain.concat(makeShopLink(getShopSlug));
  }
  return chain.concat(httpLink);
}
