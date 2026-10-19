import { defineConfig } from "eslint/config";
import { nextJsConfig } from "@repo/eslint-config/next";

const eslintConfig = defineConfig([
  ...nextJsConfig,
  {
    // `next/image` throws on a host `next.config.ts` does not list, and in the
    // App Router that throw is caught by the nearest error boundary — the whole
    // screen, over one thumbnail. Catalogue image URLs come from the importer
    // verbatim, so unlisted hosts are normal input. `shared/components/app-image`
    // is `next/image` with that case degraded to an unoptimized `<img>`.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/shared/components/app-image.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/image",
              message:
                'Import Image from "@/shared/components/app-image" instead — it survives an image host that next.config.ts does not list.',
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
