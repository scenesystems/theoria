/**
 * Built-in acquisition strategy vocabulary.
 *
 * @since 0.1.0
 * @module
 */
import { Boolean as Bool, Data, HashMap, Match, Number as Num, Option, Predicate, Record, Schema } from "effect"
import { dual } from "effect/Function"

import * as Float64 from "./internal/float64.js"
import {
  expectedImprovementScore,
  scoreWithEstimatedCost,
  sumLogDensities
} from "./internal/tpe/expectedImprovement.js"

/**
 * Built-in Bayesian acquisition strategy names.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Name = Schema.Literal("ei", "pi", "thompson")

/**
 * A built-in acquisition strategy name decoded by {@link Name}.
 *
 * @since 0.1.0
 * @category models
 */
export type Name = typeof Name.Type

/**
 * Tests whether an unknown value is a built-in acquisition strategy name.
 *
 * @since 0.1.0
 * @category guards
 */
export const isName = Schema.is(Name)

/**
 * Inputs supplied when an acquisition strategy scores one candidate.
 *
 * @since 0.7.0
 * @category models
 */
export class Context extends Data.Class<{
  /** Log-density under the promising-observation model. */
  readonly logL: number
  /** Log-density under the remaining-observation model. */
  readonly logG: number
  /** Estimated evaluation cost when cost-aware scoring is available. */
  readonly estimatedCost: Option.Option<number>
  /** Seeded random roll when a stochastic strategy requires one. */
  readonly roll: Option.Option<number>
}> {}

/**
 * Scores a candidate; larger values are preferred.
 *
 * @since 0.7.0
 * @category models
 */
export type Score = (context: Context) => number

/**
 * A named acquisition extension carrying executable scoring behavior.
 *
 * @since 0.7.0
 * @category models
 */
export class Implementation extends Data.Class<{
  /** Diagnostic strategy name. */
  readonly name: string
  /** Candidate scoring callback. */
  readonly score: Score
}> {}

/** Built-in name or custom acquisition implementation. @since 0.7.0 @category models */
export type Strategy = Name | Implementation

/** Constructs a custom acquisition implementation. @since 0.7.0 @category constructors */
export const make = (name: string, score: Score): Implementation => new Implementation({ name, score })

/** Tests whether an unknown value is an acquisition implementation. @since 0.7.0 @category guards */
export const isImplementation = (input: unknown): input is Implementation =>
  Match.value(input).pipe(
    Match.when(Predicate.isRecord, (record) =>
      Bool.and(
        Record.get(record, "name").pipe(Option.match({ onNone: () => false, onSome: Predicate.isString })),
        Record.get(record, "score").pipe(Option.match({ onNone: () => false, onSome: Predicate.isFunction }))
      )),
    Match.orElse(() => false)
  )

/** Expected-improvement acquisition. @since 0.7.0 @category strategies */
export const expectedImprovement = make(
  "ei",
  ({ estimatedCost, logG, logL }) => scoreWithEstimatedCost(expectedImprovementScore(logL, logG), estimatedCost)
)

/** Probability-of-improvement acquisition. @since 0.7.0 @category strategies */
export const probabilityOfImprovement = make(
  "pi",
  ({ estimatedCost, logG, logL }) => {
    const ratio = Float64.exp(Num.subtract(logL, logG))
    return scoreWithEstimatedCost(Num.unsafeDivide(ratio, Num.increment(ratio)), estimatedCost)
  }
)

const ROLL_EPSILON = 1e-12

const clampRoll = (roll: number): number =>
  Match.value(roll).pipe(
    Match.when(Num.lessThanOrEqualTo(ROLL_EPSILON), () => ROLL_EPSILON),
    Match.when(Num.greaterThanOrEqualTo(Num.subtract(1, ROLL_EPSILON)), () => Num.subtract(1, ROLL_EPSILON)),
    Match.orElse((value) => value)
  )

const gumbelNoise = (roll: number): number => Num.negate(Float64.log(Num.negate(Float64.log(clampRoll(roll)))))

/** Thompson-sampling acquisition. @since 0.7.0 @category strategies */
export const thompson = make(
  "thompson",
  ({ estimatedCost, logL, roll }) =>
    scoreWithEstimatedCost(
      Option.match(roll, {
        onNone: () => logL,
        onSome: (sample) => Num.sum(logL, gumbelNoise(sample))
      }),
      estimatedCost
    )
)

const implementations = HashMap.fromIterable<Name, Implementation>([
  ["ei", expectedImprovement],
  ["pi", probabilityOfImprovement],
  ["thompson", thompson]
])

/** Default acquisition strategy. @since 0.7.0 @category strategies */
export const defaultStrategy = expectedImprovement

/** Default built-in acquisition name. @since 0.7.0 @category strategies */
export const defaultName: Name = "ei"

/** Resolves a built-in name or custom implementation. @since 0.7.0 @category combinators */
export const resolve = (strategy: Strategy = defaultName): Implementation =>
  Match.value(strategy).pipe(
    Match.when(isName, (name) => HashMap.get(implementations, name).pipe(Option.getOrElse(() => defaultStrategy))),
    Match.when(isImplementation, (implementation) => implementation),
    Match.orElse(() => defaultStrategy)
  )

/** Scores one candidate with an explicit strategy. @since 0.7.0 @category combinators */
export const score: {
  (strategy: Strategy): (self: Context) => number
  (self: Context, strategy: Strategy): number
} = dual(2, (self: Context, strategy: Strategy) => resolve(strategy).score(self))

/** Scores one candidate with expected improvement. @since 0.7.0 @category combinators */
export const scoreDefault = (self: Context): number => defaultStrategy.score(self)

/** Scores one candidate from per-dimension log densities. @since 0.7.0 @category combinators */
export const scoreJoint = (
  logL: Iterable<number>,
  logG: Iterable<number>,
  estimatedCost: Option.Option<number>,
  roll: Option.Option<number>,
  strategy: Strategy = defaultName
): number =>
  score(
    new Context({
      logL: sumLogDensities(logL),
      logG: sumLogDensities(logG),
      estimatedCost,
      roll
    }),
    strategy
  )
