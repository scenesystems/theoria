/**
 * Search space definition, compilation, and conditional branching.
 *
 * @since 0.1.0
 */

export {
  /**
   * @since 0.1.0
   * @category utils
   */
  activeParameters,
  /**
   * @since 0.1.0
   * @category guards
   */
  isParameterActive
} from "./activity.js"

export {
  /**
   * @since 0.1.0
   * @category utils
   */
  fingerprint,
  /**
   * @since 0.1.0
   * @category constructors
   */
  make,
  /**
   * @since 0.1.0
   * @category constructors
   */
  makeConditional,
  /**
   * @since 0.1.0
   * @category constructors
   */
  unsafeMake,
  /**
   * @since 0.1.0
   * @category constructors
   */
  unsafeMakeConditional
} from "./compile.js"

export {
  /**
   * @since 0.1.0
   * @category constructors
   */
  extend,
  /**
   * @since 0.1.0
   * @category constructors
   */
  omit,
  /**
   * @since 0.1.0
   * @category constructors
   */
  pick
} from "./compose.js"

export {
  /**
   * @since 0.1.0
   * @category models
   */
  ConditionalGroup,
  /**
   * @since 0.1.0
   * @category models
   */
  ConditionalTracePartition,
  /**
   * @since 0.1.0
   * @category models
   */
  ConditionalTraceTrial,
  /**
   * @since 0.1.0
   * @category utils
   */
  decomposeConditionalGroups,
  /**
   * @since 0.1.0
   * @category utils
   */
  partitionTrialNumbersByRequiredParameters
} from "./conditionalTrace.js"

export {
  /**
   * @since 0.1.0
   * @category constructors
   */
  boolean,
  /**
   * @since 0.1.0
   * @category constructors
   */
  categorical,
  /**
   * @since 0.1.0
   * @category constructors
   */
  fidelity,
  /**
   * @since 0.1.0
   * @category constructors
   */
  float,
  /**
   * @since 0.1.0
   * @category constructors
   */
  int
} from "./dimensions.js"

export {
  /**
   * @since 0.1.0
   * @category constructors
   */
  switchOn,
  /**
   * @since 0.1.0
   * @category constructors
   */
  switchOn as switch,
  /**
   * @since 0.1.0
   * @category constructors
   */
  when
} from "./switch.js"

export {
  /**
   * @since 0.1.0
   * @category models
   */
  ActivationCondition,
  /**
   * @since 0.1.0
   * @category schemas
   */
  FloatOptionsSchema,
  /**
   * @since 0.1.0
   * @category schemas
   */
  IntOptionsSchema,
  /**
   * @since 0.1.0
   * @category models
   */
  ParameterMetadata,
  /**
   * @since 0.1.0
   * @category models
   */
  SearchSpace,
  /**
   * @since 0.1.0
   * @category models
   */
  SearchSpace as SearchSpaceDefinition,
  /**
   * @since 0.1.0
   * @category models
   */
  Switch,
  /**
   * @since 0.1.0
   * @category models
   */
  Switch as SwitchDefinition,
  /**
   * @since 0.1.0
   * @category models
   */
  SwitchCase,
  /**
   * @since 0.1.0
   * @category models
   */
  SwitchCase as SwitchCaseDefinition
} from "./model.js"

export type {
  /**
   * @since 0.1.0
   * @category type-level
   */
  Encoded,
  /**
   * @since 0.1.0
   * @category type-level
   */
  FloatOptions,
  /**
   * @since 0.1.0
   * @category type-level
   */
  IntOptions,
  /**
   * @since 0.1.0
   * @category type-level
   */
  Type
} from "./model.js"
