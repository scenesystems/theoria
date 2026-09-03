/**
 * ESLint configuration entry point.
 *
 * Order matters in flat config: later entries override earlier ones.
 *
 * 1. base       → ignores, inline-configuration policy, JS recommended, globals
 * 2. typescript → Babel TypeScript parsers, TypeScript-safe rule adjustments
 * 3. scopes     → Effect discipline per repository area
 *
 * @module eslint
 */

import { base } from "./base.mjs"
import { scopes } from "./scopes.mjs"
import { typescript } from "./typescript.mjs"

/**
 * @returns {import('eslint').Linter.Config[]}
 */
export const config = () => [...base(), ...typescript(), ...scopes()]
