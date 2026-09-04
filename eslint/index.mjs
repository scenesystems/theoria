/**
 * ESLint configuration entry point.
 *
 * Order matters in flat config: later entries override earlier ones.
 *
 * 1. base       → ignores, inline-configuration policy
 * 2. typescript → Babel TypeScript parsers
 * 3. scopes     → Effect discipline for every TypeScript file
 *
 * Generic JavaScript and TypeScript rules are owned by oxlint (.oxlintrc.json);
 * the two linters do not overlap.
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
