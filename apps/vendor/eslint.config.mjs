import { defineConfig } from "eslint/config";
import { nextJsConfig } from "@repo/eslint-config/next";

/**
 * The Tiptap editor scaffold, copied in from upstream rather than written here.
 *
 * The React Compiler rules below all fire on it, and every one of them is a
 * true reading of code we did not author and do not maintain: ref composition
 * writes to other components' refs by definition (`use-composed-ref`), a
 * throttle helper's `useMemo` takes the caller's dependency list rather than a
 * literal array (`use-throttled-callback`), and the menus mirror editor state
 * into React state from effects because that is how the editor publishes it.
 *
 * Fixing them in place would be rewritten away by the next upstream sync, and
 * the alternative — fifteen scattered `eslint-disable` lines — hides that these
 * are one decision rather than fifteen. So the boundary is drawn here instead,
 * as an explicit list: anything outside it is ours and is held to the rules.
 */
const TIPTAP_SCAFFOLD = [
  "src/shared/components/tiptap-templates/**",
  "src/shared/components/tiptap-ui/**",
  "src/shared/components/tiptap-ui-primitive/**",
  "src/shared/hooks/use-composed-ref.ts",
  "src/shared/hooks/use-element-rect.ts",
  "src/shared/hooks/use-menu-navigation.ts",
  "src/shared/hooks/use-throttled-callback.ts",
  "src/shared/hooks/use-tiptap-editor.ts",
  "src/shared/hooks/use-unmount.ts",
];

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
  {
    files: TIPTAP_SCAFFOLD,
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/purity": "off",
    },
  },
]);

export default eslintConfig;
