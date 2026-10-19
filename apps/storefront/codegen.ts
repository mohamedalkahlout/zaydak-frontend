import type { CodegenConfig } from "@graphql-codegen/cli";

// Read the SDL straight from the monorepo root so codegen runs without requiring
// the backend server to be up. Set CODEGEN_SCHEMA to point at a live endpoint instead.
const config: CodegenConfig = {
  schema: process.env.CODEGEN_SCHEMA || "../../schema.gql",
  documents: [
    "src/features/**/*.{ts,tsx}",
    "src/app/**/*.{ts,tsx}",
    "src/shared/**/*.{ts,tsx}",
    "!src/shared/api/generated/**",
    // Tests are not operations. A test that builds a document of its own (a
    // probe to read the headers a request carries, say) is typed by nothing,
    // executes against a stub, and must not decide whether the app's codegen
    // passes: a probe selecting a field the schema lacks stopped this app's
    // codegen, and even a valid one shipped in the production `gql.ts` map and
    // took an operation name from the app's global namespace.
    "!src/**/__tests__/**",
    "!src/**/*.{test,spec}.{ts,tsx}",
    // The refresh route runs server-to-server GraphQL as a raw fetch against a
    // `/* GraphQL */` string, not a `gql` tag — keep it out of the document set.
    "!src/app/api/**",
  ],
  generates: {
    "src/shared/api/generated/": {
      preset: "client",
      plugins: [],
      presetConfig: {
        gqlTagName: "gql",
        // Off, deliberately. Fragment masking makes a fragment's fields
        // unreadable without `useFragment` at every call site, which is a good
        // trade in an app where components own their own data requirements.
        // Here the fragments exist for one reason — the product-card field list
        // and the cart envelope are repeated across a dozen operations and must
        // not drift — and the consumers are plain render helpers that take the
        // whole object. Masking would buy nothing and cost an unwrap per usage.
        fragmentMasking: false,
      },
      config: {
        // String unions rather than TS `enum`s. The catalogue keeps its sort and
        // stock filters in the URL, so they arrive as strings; with real enums
        // every read would need a lookup back into the enum object just to
        // satisfy the compiler about a value that is already correct.
        enumsAsTypes: true,
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
