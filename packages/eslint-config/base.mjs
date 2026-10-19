import { globalIgnores } from "eslint/config";

/**
 * Ignores shared by every workspace package. `eslint-config-next` ships its own
 * default ignores, but declaring them here means non-Next packages get the same
 * treatment, and Next apps can re-declare them without drifting.
 */
export const baseConfig = [
  globalIgnores(["**/node_modules/**", "**/dist/**", "**/.turbo/**"]),
];

export default baseConfig;
