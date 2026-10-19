import { globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

import { baseConfig } from "./base.mjs";

/**
 * Flat config for the Next.js apps in `apps/*`.
 *
 * The `globalIgnores` call re-states the defaults that `eslint-config-next`
 * would otherwise apply on its own — spreading its config into a
 * `defineConfig` array drops them, so they have to be declared explicitly.
 */
export const nextJsConfig = [
  ...baseConfig,
  ...nextVitals,
  ...nextTs,
  {
    // Test doubles are annotated `any` on purpose. A mock's job is to accept
    // whatever the test hands it — a gql document, a store selector, the props
    // of a component being stubbed out — and writing the real signature of the
    // thing being replaced would be noise that has to be maintained alongside
    // the type it is standing in for. Confined to test files; production code
    // still cannot reach for `any`.
    files: [
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.{test,spec}.{ts,tsx}",
      "**/test/setup.{ts,tsx}",
    ],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    // A `<form>` with no `method` is a GET form. Every form here is submitted
    // by an `onSubmit` handler, but that handler only exists once React has
    // hydrated — press Sign in (or Enter) a moment earlier and the browser
    // submits natively, writing every named field into the query string:
    // `/login?identifier=…&password=…`, then into history, the address bar and
    // the host's request logs. `method="post"` keeps a native submit in the
    // body, where a plain urlencoded POST just re-renders the page.
    files: [
      "**/app/(auth)/**/*.tsx",
      "**/features/auth/**/*.tsx",
      "**/features/signup/**/*.tsx",
      "**/change-password/**/*.tsx",
    ],
    ignores: ["**/__tests__/**", "**/*.{test,spec}.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name='form']:not(:has(JSXAttribute[name.name='method'][value.value='post']))",
          message:
            'Credential forms must declare method="post" — before hydration a GET form puts the password in the URL.',
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
];

export default nextJsConfig;
