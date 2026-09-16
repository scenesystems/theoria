/**
 * Canonical study event vocabulary, constructors, guards, and matching.
 *
 * @since 0.7.0
 * @module
 */
import { Data, Schema } from "effect"

import * as Stop from "@scenesystems/effect-study/Stop"
import { Value } from "./Objective.js"
import { Decision as PruneDecision } from "./Pruning.js"
import { TrialError } from "./SearchError.js"

/** Why a study stopped admitting work. @since 0.7.0 @category schemas */
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

const TrialStarted = Schema.TaggedStruct("TrialStarted", { trialNumber: Schema.Number, config: Schema.Unknown })
const TrialReported = Schema.TaggedStruct("TrialReported", {
  trialNumber: Schema.Number,
  step: Schema.Number,
  value: Schema.Number,
  decision: PruneDecision
})
const TrialCompleted = Schema.TaggedStruct("TrialCompleted", { trialNumber: Schema.Number, value: Value })
const TrialCosted = Schema.TaggedStruct("TrialCosted", {
  trialNumber: Schema.Number,
  cost: Schema.Number,
  cumulativeCost: Schema.Number
})
const TrialPruned = Schema.TaggedStruct("TrialPruned", {
  trialNumber: Schema.Number,
  step: Schema.Number,
  reason: Schema.String,
  policy: Schema.String
})
const TrialRetried = Schema.TaggedStruct("TrialRetried", {
  trialNumber: Schema.Number,
  attempt: Schema.Number,
  error: TrialError
})
const TrialCancelled = Schema.TaggedStruct("TrialCancelled", {
  trialNumber: Schema.Number,
  reason: Schema.Literal("timeout")
})
const TrialFailed = Schema.TaggedStruct("TrialFailed", { trialNumber: Schema.Number, error: TrialError })
const BestUpdated = Schema.TaggedStruct("BestUpdated", { trialNumber: Schema.Number, value: Schema.Number })
const StopRequested = Schema.TaggedStruct("StopRequested", {
  mode: Stop.Mode,
  reason: Schema.String,
  requestedByTrialNumber: Schema.Number
})
const BracketStarted = Schema.TaggedStruct("BracketStarted", {
  bracketIndex: Schema.Number,
  configs: Schema.Number,
  minResource: Schema.Number
})
const RoundStarted = Schema.TaggedStruct("RoundStarted", {
  bracketIndex: Schema.Number,
  roundIndex: Schema.Number,
  nConfigs: Schema.Number,
  resource: Schema.Number
})
const RoundCompleted = Schema.TaggedStruct("RoundCompleted", {
  bracketIndex: Schema.Number,
  roundIndex: Schema.Number,
  nConfigs: Schema.Number,
  resource: Schema.Number,
  completed: Schema.Number
})
const BracketCompleted = Schema.TaggedStruct("BracketCompleted", {
  bracketIndex: Schema.Number,
  rounds: Schema.Number,
  bestValue: Schema.optional(Schema.Number)
})
const Completed = Schema.TaggedStruct("Completed", { completionReason: CompletionReason })

/** All study events accepted at persistence boundaries. @since 0.7.0 @category schemas */
export const StudyEvent = Schema.Union(
  TrialStarted,
  TrialReported,
  TrialCompleted,
  TrialCosted,
  TrialPruned,
  TrialRetried,
  TrialCancelled,
  TrialFailed,
  BestUpdated,
  StopRequested,
  BracketStarted,
  RoundStarted,
  RoundCompleted,
  BracketCompleted,
  Completed
)
/** A study lifecycle event. @since 0.7.0 @category models */
export type StudyEvent = typeof StudyEvent.Type

const Events = Data.taggedEnum<StudyEvent>()

/** Constructs a trial reservation event. @since 0.7.0 @category constructors */
export const trialStarted = Events.TrialStarted
/** Constructs an intermediate report event. @since 0.7.0 @category constructors */
export const trialReported = Events.TrialReported
/** Constructs a successful trial event. @since 0.7.0 @category constructors */
export const trialCompleted = Events.TrialCompleted
/** Constructs a trial cost event. @since 0.7.0 @category constructors */
export const trialCosted = Events.TrialCosted
/** Constructs a pruning event. @since 0.7.0 @category constructors */
export const trialPruned = Events.TrialPruned
/** Constructs a retry event. @since 0.7.0 @category constructors */
export const trialRetried = Events.TrialRetried
/** Constructs a cancellation event. @since 0.7.0 @category constructors */
export const trialCancelled = Events.TrialCancelled
/** Constructs a failure event. @since 0.7.0 @category constructors */
export const trialFailed = Events.TrialFailed
/** Constructs an incumbent update event. @since 0.7.0 @category constructors */
export const bestUpdated = Events.BestUpdated
/** Constructs a study stop-request event. @since 0.7.0 @category constructors */
export const stopRequested = Events.StopRequested
/** Constructs a bracket-start event. @since 0.7.0 @category constructors */
export const bracketStarted = Events.BracketStarted
/** Constructs a round-start event. @since 0.7.0 @category constructors */
export const roundStarted = Events.RoundStarted
/** Constructs a round-completion event. @since 0.7.0 @category constructors */
export const roundCompleted = Events.RoundCompleted
/** Constructs a bracket-completion event. @since 0.7.0 @category constructors */
export const bracketCompleted = Events.BracketCompleted
/** Constructs the terminal study event. @since 0.7.0 @category constructors */
export const completed = Events.Completed
/** Narrows an event by tag. @since 0.7.0 @category guards */
export const is = Events.$is
/** Exhaustively matches an event. @since 0.7.0 @category pattern-matching */
export const match = Events.$match
/** Tests whether unknown input is a decoded study event. @since 0.7.0 @category guards */
export const isStudyEvent = Schema.is(StudyEvent)
