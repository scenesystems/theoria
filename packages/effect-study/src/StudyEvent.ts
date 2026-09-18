/**
 * Schema factories for domain-generic study lifecycle events.
 *
 * @since 0.1.0
 * @module
 */
import { Schema } from "effect"

import * as Stop from "./Stop.js"

/** Builds a typed trial reservation event schema. @since 0.1.0 @category schemas */
export const TrialStarted = <Config extends Schema.Schema.All>(config: Config) =>
  Schema.TaggedStruct("TrialStarted", { trialNumber: Schema.Number, config }).annotations({
    identifier: "@scenesystems/effect-study/StudyEvent/TrialStarted"
  })

/** Builds a typed successful trial event schema. @since 0.1.0 @category schemas */
export const TrialCompleted = <Observation extends Schema.Schema.All>(observation: Observation) =>
  Schema.TaggedStruct("TrialCompleted", { trialNumber: Schema.Number, value: observation }).annotations({
    identifier: "@scenesystems/effect-study/StudyEvent/TrialCompleted"
  })

/** Builds a typed failed trial event schema. @since 0.1.0 @category schemas */
export const TrialFailed = <Failure extends Schema.Schema.All>(failure: Failure) =>
  Schema.TaggedStruct("TrialFailed", { trialNumber: Schema.Number, error: failure }).annotations({
    identifier: "@scenesystems/effect-study/StudyEvent/TrialFailed"
  })

/** Builds a typed retry event schema. @since 0.1.0 @category schemas */
export const TrialRetried = <Failure extends Schema.Schema.All>(failure: Failure) =>
  Schema.TaggedStruct("TrialRetried", {
    trialNumber: Schema.Number,
    attempt: Schema.Number,
    error: failure
  }).annotations({
    identifier: "@scenesystems/effect-study/StudyEvent/TrialRetried"
  })

/** Builds a typed cancellation event schema. @since 0.1.0 @category schemas */
export const TrialCancelled = <Reason extends Schema.Schema.All>(reason: Reason) =>
  Schema.TaggedStruct("TrialCancelled", { trialNumber: Schema.Number, reason }).annotations({
    identifier: "@scenesystems/effect-study/StudyEvent/TrialCancelled"
  })

/** Trial cost accounting independent of an objective's value type. @since 0.1.0 @category schemas */
export const TrialCosted = Schema.TaggedStruct("TrialCosted", {
  trialNumber: Schema.Number,
  cost: Schema.Number,
  cumulativeCost: Schema.Number
}).annotations({ identifier: "@scenesystems/effect-study/StudyEvent/TrialCosted" })

/** Cooperative stop requests shared by study execution strategies. @since 0.1.0 @category schemas */
export const StopRequested = Schema.TaggedStruct("StopRequested", {
  mode: Stop.Mode,
  reason: Schema.String,
  requestedByTrialNumber: Schema.Number
}).annotations({ identifier: "@scenesystems/effect-study/StudyEvent/StopRequested" })

/** Builds a typed terminal study-completion event schema. @since 0.1.0 @category schemas */
export const Completed = <Reason extends Schema.Schema.All>(completionReason: Reason) =>
  Schema.TaggedStruct("Completed", { completionReason }).annotations({
    identifier: "@scenesystems/effect-study/StudyEvent/Completed"
  })
