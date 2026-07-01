import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

// Next 16 ships native ESLint flat configs, so we consume them directly
// instead of the old FlatCompat wrapper (which trips over a circular plugin
// reference on this version).
const eslintConfig = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...coreWebVitals,
  ...typescript,
  {
    // Scope to the files where eslint-config-next registers react-hooks.
    files: ['**/*.{ts,tsx}'],
    rules: {
      // New in the React-Compiler-era react-hooks plugin (Next 16). Our
      // loading flags and init-from-storage effects call setState in effects
      // intentionally; keep this as a warning, not a hard error.
      'react-hooks/set-state-in-effect': 'warn'
    }
  }
]

export default eslintConfig
