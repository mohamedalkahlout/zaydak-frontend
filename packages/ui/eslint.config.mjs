import { defineConfig } from "eslint/config";
import { nextJsConfig } from "@repo/eslint-config/next";

/**
 * These components ship into Next.js apps, so they are held to the same
 * core-web-vitals rules the apps are.
 */
export default defineConfig([...nextJsConfig]);
