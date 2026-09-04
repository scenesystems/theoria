/**
 * Effect discipline rule set.
 *
 * Every array is a list of `no-restricted-syntax` entries. ESLint flat config
 * replaces (never merges) `no-restricted-syntax` when several blocks match one
 * file, so `../scopes.mjs` receives one fully composed array.
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

/**
 * Effect discipline for every TypeScript file: no async/throw/let/loops/console
 * or mutable builtins, no type assertions or utility types, schema-first type
 * modeling and Option instead of `undefined` bridges.
 */
export const EFFECT_RULES = [
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
  ...TACIT_USAGE_RULES,
  ...TYPE_MODELING_RULES,
  ...OPTION_DISCIPLINE_RULES
]
