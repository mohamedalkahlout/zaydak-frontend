import { defineConfig } from "eslint/config";
import { nextJsConfig } from "@repo/eslint-config/next";

const eslintConfig = defineConfig([...nextJsConfig]);

export default eslintConfig;
