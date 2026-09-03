/**
 * Typed configuration spaces with sampler metadata and conditional branches.
 *
 * @remarks
 * Dimension constructors attach sampling distributions to Effect Schemas.
 * Compilation validates those distributions and produces the schema used to
 * decode sampler output. Numeric bounds and steps govern sampling but are not
 * added as decode refinements; use a separately refined schema when accepting
 * configurations from an untrusted boundary.
 *
 * @since 0.1.0
 */

export { activeParameters, isParameterActive } from "./activity.js"

export { fingerprint, make, makeConditional, unsafeMake, unsafeMakeConditional } from "./compile.js"

export { extend, omit, pick } from "./compose.js"

export {
  ConditionalGroup,
  ConditionalTracePartition,
  ConditionalTraceTrial,
  decomposeConditionalGroups,
  partitionTrialNumbersByRequiredParameters
} from "./conditionalTrace.js"

export { boolean, categorical, fidelity, float, int } from "./dimensions.js"

export { switchOn, switchOn as switch, when } from "./switch.js"

export {
  ActivationCondition,
  FloatOptionsSchema,
  IntOptionsSchema,
  ParameterMetadata,
  SearchSpace,
  SearchSpace as SearchSpaceDefinition,
  Switch,
  Switch as SwitchDefinition,
  SwitchCase,
  SwitchCase as SwitchCaseDefinition
} from "./model.js"

export type { Encoded, FloatOptions, IntOptions, Type } from "./model.js"
