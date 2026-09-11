import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["out", "release", "coverage"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        Image: "readonly",
        ImageData: "readonly",
        Worker: "readonly",
        URL: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLImageElement: "readonly",
        ImageBitmap: "readonly",
        OffscreenCanvas: "readonly",
        createImageBitmap: "readonly",
        requestAnimationFrame: "readonly"
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { "allowConstantExport": true }],
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
);
