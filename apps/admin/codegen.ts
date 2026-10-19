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
    // `/* GraphQL */` string, not a `gql` tag. Its operation name collides with
    // nothing today, but it is never executed through Apollo — keep it out.
    "!src/app/api/**",
  ],
  generates: {
    "src/shared/api/generated/": {
      preset: "client",
      plugins: [],
      presetConfig: {
        gqlTagName: "gql",
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
