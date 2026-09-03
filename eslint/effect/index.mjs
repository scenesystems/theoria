/**
 * Effect discipline rule sets.
 *
 * Every array is a list of `no-restricted-syntax` entries. ESLint flat config
 * replaces (never merges) `no-restricted-syntax` when several blocks match one
 * file, so each scope in `../scopes.mjs` receives one fully composed array.
 *
 * - CORE_RULES apply to every TypeScript file in the repository.
 * - TYPE_MODELING_RULES add schema-first modeling; only library code carries them.
 * - OPTION_DISCIPLINE_RULES ban `| undefined` bridges; React props are exempt.
 *
 * @module eslint/effect
 */

import {
  ARRAY_BUILTINS_RULES,
  ARRAY_MUTATION_RULES,
  COLLECTIONS_RULES,
  JSON_BUILTINS_RULES,
  OBJECT_BUILTINS_RULES,
  TIME_RANDOMNESS_RULES
} from "./builtins.mjs"
import {
  ABORT_CONTROLLER_RULES,
  ENTRY_POINT_RULES,
  IMPERATIVE_LOOP_RULES,
  NO_ASYNC_RULES,
  NO_LET_RULES,
  NO_THROW_TRY_RULES,
  PROMISE_CHAINING_RULES,
  SWITCH_STATEMENT_RULES
} from "./control-flow.mjs"
import {
  ERROR_SWALLOWING_RULES,
  ERROR_TYPE_ANNOTATION_RULES,
  NO_CONSOLE_RULES,
  NO_LOG_INTERPOLATION_RULES,
  NO_NEW_ERROR_RULES
} from "./errors.mjs"
import {
  MODULE_STUB_RULES,
  OPTION_DISCIPLINE_RULES,
  TACIT_USAGE_RULES,
  TYPE_ASSERTION_RULES,
  TYPE_MODELING_RULES,
  UTILITY_TYPE_RULES
} from "./types.mjs"

export { OPTION_DISCIPLINE_RULES, TYPE_MODELING_RULES }

/**
 * Effect discipline shared by library, application and tooling code.
 */
export const CORE_RULES = [
  ...NO_ASYNC_RULES,
  ...PROMISE_CHAINING_RULES,
  ...NO_THROW_TRY_RULES,
  ...NO_NEW_ERROR_RULES,
  ...ERROR_TYPE_ANNOTATION_RULES,
  ...ERROR_SWALLOWING_RULES,
  ...NO_CONSOLE_RULES,
  ...NO_LOG_INTERPOLATION_RULES,
  ...NO_LET_RULES,
  ...IMPERATIVE_LOOP_RULES,
  ...SWITCH_STATEMENT_RULES,
  ...ENTRY_POINT_RULES,
  ...ABORT_CONTROLLER_RULES,
  ...COLLECTIONS_RULES,
  ...TIME_RANDOMNESS_RULES,
  ...JSON_BUILTINS_RULES,
  ...OBJECT_BUILTINS_RULES,
  ...ARRAY_MUTATION_RULES,
  ...ARRAY_BUILTINS_RULES,
  ...TYPE_ASSERTION_RULES,
  ...UTILITY_TYPE_RULES,
  ...MODULE_STUB_RULES,
  ...TACIT_USAGE_RULES
]

/**
 * Library code: core discipline plus schema-first modeling and Option discipline.
 */
export const LIBRARY_RULES = [...CORE_RULES, ...TYPE_MODELING_RULES, ...OPTION_DISCIPLINE_RULES]

/**
 * Application `.ts` code: core discipline plus Option discipline. Application
 * modules may declare plain type aliases and interfaces for view models.
 */
export const APPLICATION_RULES = [...CORE_RULES, ...OPTION_DISCIPLINE_RULES]

const OMIT_SELECTOR = "TSTypeReference[typeName.name='Omit']"

/**
 * React view code: core discipline only. Component props inherently use
 * `| undefined`, `=== undefined` and `Omit<>` over upstream prop types.
 */
export const VIEW_RULES = CORE_RULES.filter((rule) => rule.selector !== OMIT_SELECTOR)
