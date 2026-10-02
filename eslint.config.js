import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Calendar dates on this site are America/New_York. toISOString() is UTC
      // and flips to tomorrow at 8 PM Eastern, which filed evening sign-ups,
      // check-ins and receipts under the next day (fixed site-wide 2026-10-02).
      "no-restricted-syntax": ["error", {
        selector: "MemberExpression[property.name=/^(split|slice|substring)$/] > CallExpression[callee.property.name=\"toISOString\"]",
        message: "Never derive a calendar date from toISOString() (UTC). For today use todayNY() from \"@/lib/programYear\"; in an edge function use toLocaleDateString(\"en-CA\", { timeZone: \"America/New_York\" }); for another date build YYYY-MM-DD from local getters.",
      }],
    },
  },
);
