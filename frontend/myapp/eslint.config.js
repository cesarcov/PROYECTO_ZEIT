import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // ── LÍNEA BASE DEL TRINQUETE (F-000 / T-06) ─────────────────────────
      // El código heredado arrastra 83 hallazgos. En vez de bloquear el CI de
      // golpe (o desactivar las reglas y perderlas), se degradan a WARNING y
      // el pipeline corre con `--max-warnings` fijado al recuento actual: se
      // puede bajar, nunca subir. Cada vez que un grupo quede en cero, se
      // vuelve a subir a 'error' aquí y ya no se puede retroceder.
      // El número vive en el script `lint` de package.json.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
])
