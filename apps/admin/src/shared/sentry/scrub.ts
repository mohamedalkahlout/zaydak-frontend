/**
 * Last-line scrub for admin Sentry events (browser / server / edge).
 * Mirrors vendor `shared/sentry/scrub.ts` and back-end `sentry-scrub.ts`.
 */

const REDACTED = "[Filtered]";

const SENSITIVE_KEY =
  /^(authorization|cookie|set-cookie|x-api-key|x-auth-token|api[_-]?key|access[_-]?token|refresh[_-]?token|id_token|password|passwd|secret|client_secret|private[_-]?key|otp|one[_-]?time|verification[_-]?code|reset[_-]?token|magic[_-]?link|bearer|jwt|dsn|credit[_-]?card|card[_-]?number|cvv|cvc|ssn)$/i;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

function scrubString(value: string): string {
  let out = value.replace(
    /\b(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi,
    `$1${REDACTED}`,
  );
  out = out.replace(
    /\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]*/g,
    REDACTED,
  );
  out = out.replace(
    /((?:otp|code|password|token|secret)\s*[=:]\s*)[^\s&,;]+/gi,
    `$1${REDACTED}`,
  );
  return out;
}

function scrubDeep(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 8) return REDACTED;
  if (typeof value === "string") return scrubString(value);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => scrubDeep(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? REDACTED : scrubDeep(child, depth + 1);
  }
  return out;
}

/** Sentry QueryParams: string, record, or entry pairs (SDK union drift). */
type QueryString = string | Record<string, string> | [string, string][];

function scrubQueryPairs(pairs: [string, string][]): [string, string][] {
  return pairs.map(([key, value]) => [
    key,
    isSensitiveKey(key) ? REDACTED : scrubString(value),
  ]);
}

type ScrubbableEvent = {
  request?: {
    headers?: Record<string, string>;
    cookies?: Record<string, string> | string;
    data?: unknown;
    query_string?: QueryString;
  };
  user?: { id?: string; email?: string | null } | null;
  extra?: Record<string, unknown>;
  breadcrumbs?: {
    values?: Array<{ message?: string; data?: Record<string, unknown> }>;
  };
};

export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    const req = event.request;
    if (req.headers) {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        headers[k] = isSensitiveKey(k) ? REDACTED : scrubString(String(v));
      }
      req.headers = headers;
    }
    if (req.cookies) {
      req.cookies =
        typeof req.cookies === "string"
          ? REDACTED
          : (scrubDeep(req.cookies) as Record<string, string>);
    }
    if (req.data != null && typeof req.data === "object") {
      req.data = scrubDeep(req.data);
    }
    if (typeof req.query_string === "string") {
      try {
        const params = new URLSearchParams(
          req.query_string.startsWith("?")
            ? req.query_string.slice(1)
            : req.query_string,
        );
        const next = new URLSearchParams();
        for (const [key, value] of params.entries()) {
          next.set(key, isSensitiveKey(key) ? REDACTED : scrubString(value));
        }
        req.query_string = next.toString();
      } catch {
        req.query_string = scrubString(req.query_string);
      }
    } else if (Array.isArray(req.query_string)) {
      req.query_string = scrubQueryPairs(req.query_string);
    } else if (req.query_string && typeof req.query_string === "object") {
      req.query_string = scrubDeep(req.query_string) as Record<string, string>;
    }
  }

  if (event.user) {
    event.user = { id: event.user.id };
  }

  if (event.extra) {
    event.extra = scrubDeep(event.extra) as Record<string, unknown>;
  }

  if (event.breadcrumbs?.values) {
    for (const crumb of event.breadcrumbs.values) {
      if (crumb.message) crumb.message = scrubString(crumb.message);
      if (crumb.data) {
        crumb.data = scrubDeep(crumb.data) as Record<string, unknown>;
      }
    }
  }

  return event;
}
