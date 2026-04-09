/**
 * Multi-chain-comparison module constructor.
 *
 * @since 0.2.0
 */
import type { Schema } from "effect"
import { Array as Arr, Effect, Match } from "effect"

import type { CompositionError } from "../../Errors/module.js"
import type { SignatureError } from "../../Errors/signature.js"
import type { Signature } from "../../Signature/model.js"
import { chainOfThought } from "../chainOfThought/index.js"
import { compose } from "../compose/index.js"
import type { Module } from "../model.js"
import { MultiChainComparisonRuntime } from "./runtime.js"
import { ComparisonSignature } from "./signatures.js"

/**
 * Default number of candidate reasoning chains generated before comparison.
 *
 * @since 0.2.0
 * @category constants
 */
export const DEFAULT_MULTI_CHAIN_COMPARISON_CANDIDATE_COUNT = 3

/**
 * Default concurrency used while generating candidate reasoning chains.
 *
 * @since 0.2.0
 * @category constants
 */
export const DEFAULT_MULTI_CHAIN_COMPARISON_CONCURRENCY = 1

/**
 * Default deterministic seed offset applied to candidate rollout identity.
 *
 * @since 0.2.0
 * @category constants
 */
export const DEFAULT_MULTI_CHAIN_COMPARISON_SEED = 0

/**
 * Constructor options for `Module.multiChainComparison`.
 *
 * @since 0.2.0
 * @category models
 */
export type MultiChainComparisonOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> = Readonly<{
  readonly name: string
  readonly signature: Signature<I, O>
  readonly candidateCount?: number
  readonly concurrency?: number
  readonly seed?: number
}>

const normalizePositive = (value: number): number =>
  Match.value(value).pipe(
    Match.when((candidate) => candidate < 1, () => 1),
    Match.orElse((candidate) => candidate)
  )

const normalizeSeed = (seed: number): number =>
  Match.value(seed).pipe(
    Match.when((candidate) => candidate < 0, () => 0),
    Match.orElse((candidate) => candidate)
  )

const candidateModuleName = (moduleName: string, candidateIndex: number): string =>
  `${moduleName}-candidate-${candidateIndex + 1}`

/**
 * Create a module that compares multiple chain-of-thought candidates and then
 * projects the comparison verdict back onto the original signature.
 *
 * @since 0.2.0
 * @category constructors
 */
export const multiChainComparison = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  options: MultiChainComparisonOptions<I, O>
): Effect.Effect<Module<I, O>, SignatureError | CompositionError> =>
  Effect.gen(function*() {
    const candidateCount = normalizePositive(
      options.candidateCount ?? DEFAULT_MULTI_CHAIN_COMPARISON_CANDIDATE_COUNT
    )
    const concurrency = normalizePositive(
      options.concurrency ?? DEFAULT_MULTI_CHAIN_COMPARISON_CONCURRENCY
    )
    const seed = normalizeSeed(options.seed ?? DEFAULT_MULTI_CHAIN_COMPARISON_SEED)
    const candidates = yield* Effect.forEach(
      Arr.range(0, candidateCount - 1),
      (candidateIndex) =>
        chainOfThought(candidateModuleName(options.name, candidateIndex), options.signature).pipe(
          Effect.map((module) => ({
            candidateIndex,
            module
          }))
        )
    )
    const comparisonSignature = yield* ComparisonSignature.make({
      candidateCount,
      signature: options.signature
    })
    const compare = yield* chainOfThought(`${options.name}-compare`, comparisonSignature)

    return yield* compose({
      name: options.name,
      signature: options.signature,
      subModules: Arr.reduce(
        candidates,
        {
          compare
        },
        (state, candidate) => ({
          ...state,
          [`candidate${candidate.candidateIndex + 1}`]: candidate.module
        })
      ),
      forward: ({ input }) =>
        MultiChainComparisonRuntime.forward({
          candidates,
          compare,
          concurrency,
          moduleName: options.name,
          seed,
          signature: options.signature
        })(input)
    })
  })
