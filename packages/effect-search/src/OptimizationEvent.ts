/**
 * Canonical optimization event vocabulary, constructors, guards, and matching.
 *
 * @since 0.7.0
 * @module
 */
import { Data, Schema } from "effect"

import * as StudyEvent from "@scenesystems/effect-study/StudyEvent"
import { Value } from "./Objective.js"
import { Decision as PruneDecision } from "./Pruning.js"
import { TrialError } from "./SearchError.js"

/** Why an optimization stopped admitting work. @since 0.7.0 @category schemas */
export const CompletionReason = Schema.Literal(
  "budgetExhausted",
  "spaceExhausted",
  "interrupted",
  "durationExceeded",
  "targetReached",
  "convergence",
  "noImprovement"
)
/** @since 0.7.0 @category models */
export type CompletionReason = typeof CompletionReason.Type

/** All optimization events accepted at persistence boundaries. @since 0.7.0 @category schemas */
export const OptimizationEvent = Schema.Union(
  StudyEvent.TrialStarted(Schema.Unknown),
  Schema.TaggedStruct("TrialReported", {
    trialNumber: Schema.Number,
    step: Schema.Number,
    value: Schema.Number,
    decision: PruneDecision
  }),
  StudyEvent.TrialCompleted(Value),
  StudyEvent.TrialCosted,
  Schema.TaggedStruct("TrialPruned", {
    trialNumber: Schema.Number,
    step: Schema.Number,
    reason: Schema.String,
    policy: Schema.String
  }),
  StudyEvent.TrialRetried(TrialError),
  StudyEvent.TrialCancelled(Schema.Literal("timeout")),
  StudyEvent.TrialFailed(TrialError),
  Schema.TaggedStruct("BestUpdated", { trialNumber: Schema.Number, value: Schema.Number }),
  StudyEvent.StopRequested,
  Schema.TaggedStruct("BracketStarted", {
    bracketIndex: Schema.Number,
    configs: Schema.Number,
    minResource: Schema.Number
  }),
  Schema.TaggedStruct("RoundStarted", {
    bracketIndex: Schema.Number,
    roundIndex: Schema.Number,
    nConfigs: Schema.Number,
    resource: Schema.Number
  }),
  Schema.TaggedStruct("RoundCompleted", {
    bracketIndex: Schema.Number,
    roundIndex: Schema.Number,
    nConfigs: Schema.Number,
    resource: Schema.Number,
    completed: Schema.Number
  }),
  Schema.TaggedStruct("BracketCompleted", {
    bracketIndex: Schema.Number,
    rounds: Schema.Number,
    bestValue: Schema.optional(Schema.Number)
  }),
  StudyEvent.Completed(CompletionReason)
)
/** An optimization lifecycle event. @since 0.7.0 @category models */
export type OptimizationEvent = typeof OptimizationEvent.Type

const Events = Data.taggedEnum<OptimizationEvent>()

/** Constructs a trial reservation event. @since 0.7.0 @category constructors */
export const TrialStarted = Events.TrialStarted
/** Constructs an intermediate report event. @since 0.7.0 @category constructors */
export const TrialReported = Events.TrialReported
/** Constructs a successful trial event. @since 0.7.0 @category constructors */
export const TrialCompleted = Events.TrialCompleted
/** Constructs a trial cost event. @since 0.7.0 @category constructors */
export const TrialCosted = Events.TrialCosted
/** Constructs a pruning event. @since 0.7.0 @category constructors */
export const TrialPruned = Events.TrialPruned
/** Constructs a retry event. @since 0.7.0 @category constructors */
export const TrialRetried = Events.TrialRetried
/** Constructs a cancellation event. @since 0.7.0 @category constructors */
export const TrialCancelled = Events.TrialCancelled
/** Constructs a failure event. @since 0.7.0 @category constructors */
export const TrialFailed = Events.TrialFailed
/** Constructs an incumbent update event. @since 0.7.0 @category constructors */
export const BestUpdated = Events.BestUpdated
/** Constructs an optimization stop-request event. @since 0.7.0 @category constructors */
export const StopRequested = Events.StopRequested
/** Constructs a bracket-start event. @since 0.7.0 @category constructors */
export const BracketStarted = Events.BracketStarted
/** Constructs a round-start event. @since 0.7.0 @category constructors */
export const RoundStarted = Events.RoundStarted
/** Constructs a round-completion event. @since 0.7.0 @category constructors */
export const RoundCompleted = Events.RoundCompleted
/** Constructs a bracket-completion event. @since 0.7.0 @category constructors */
export const BracketCompleted = Events.BracketCompleted
/** Constructs the terminal optimization event. @since 0.7.0 @category constructors */
export const Completed = Events.Completed
/** Narrows an event by tag. @since 0.7.0 @category guards */
export const is = Events.$is
/** Exhaustively matches an event. @since 0.7.0 @category pattern-matching */
export const match = Events.$match
/** Tests whether unknown input is a decoded optimization event. @since 0.7.0 @category guards */
export const isEvent = Schema.is(OptimizationEvent)
