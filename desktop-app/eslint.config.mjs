import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['node_modules/**', 'build/**', 'release/**', '整体架构必须先读/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['desktop/**/*.ts', 'scripts/**/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } }, rules: { 'no-console': 'error', '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/ban-ts-comment': 'error' } },
]
