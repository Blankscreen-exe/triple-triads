import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Client and shared code must not import server-only modules.
    files: ['src/app/**', 'src/components/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/server/*', '**/server/*'], message: 'Server-only module.' }] },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'dist/**', 'next-env.d.ts']),
]);
