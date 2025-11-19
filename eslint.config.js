import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
    globalIgnores(['dist']),
    {
        files: ['**/*.{ts,tsx}'],
        extends: [
            js.configs.recommended,
            tslint.configs.strictTypeChecked,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            ecmaVersion: 2024,
            globals: globals.browser,
            parserOptions: {
                // NOTE: Enables type-aware linting. May slow down linting.
                // Can be removed if performance becomes an issue.
                project: ['./tsconfig.app.json', './tsconfig.node.json'],
            },
        },
    },
])
