/**
 * Copies a seeded subset of labeled examples into module parameters.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.1.0
 * @module
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import type { Schema } from "effect"
import { Array as Arr, Data, Effect, Match, Option, Order, Ref } from "effect"
import { nextDeterministicSeed, normalizeDeterministicSeed } from "../../contracts/DeterministicSeed.js"
import { withModuleParamsDemos } from "../../contracts/ModuleParams.js"
import { Demo, type Example } from "../../Example/index.js"
import { collectModuleParamRefs } from "../../internal/module-params.js"
import type { Module } from "../../Module/model.js"

class ScoredDemo extends Data.Class<{
  readonly score: number
  readonly demo: Demo
}> {}

class SamplingState extends Data.Class<{
  readonly seed: number
  readonly scored: ReadonlyArray<ScoredDemo>
}> {}

const scoredDemoOrder: Order.Order<ScoredDemo> = Order.mapInput(Order.number, (entry) => entry.score)

/**
 * Configures seeded demonstration replacement without model execution.
 *
 * @typeParam I - Root module input fields; examples remain unvalidated here.
 * @typeParam O - Root module output fields; examples remain unvalidated here.
 *
 * @since 0.1.0
 * @category models
 */
export class LabeledFewShotOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> extends Data.Class<{
  /** Module whose root and discovered submodule parameter refs are updated. */
  readonly module: Module<I, O>
  /** Source examples; entries without `output` are ignored. */
  readonly trainset: ReadonlyArray<Example>
  /** Selection cap, rounded down; negative and non-finite values select none. */
  readonly k: number
  /** Pseudo-random selection seed. Defaults to `1`. */
  readonly seed?: number
}> {}

const labeledDemos = (trainset: ReadonlyArray<Example>): ReadonlyArray<Demo> =>
  Arr.filterMap(
    trainset,
    (example) =>
      Option.map(
        Option.fromNullable(example.output),
        (output) => new Demo({ input: example.input, output })
      )
  )

const selectRandomDemos = (demos: ReadonlyArray<Demo>, k: number, seed: number): ReadonlyArray<Demo> => {
  const normalizedK = Match.value(k).pipe(
    Match.when(Numeric.isFinite, (value) => Numeric.max(0, Numeric.floor(value))),
    Match.orElse(() => 0)
  )
  const scored = Arr.reduce(
    demos,
    new SamplingState({ seed: normalizeDeterministicSeed(seed), scored: Arr.empty<ScoredDemo>() }),
    (state, demo) => {
      const next = nextDeterministicSeed(state.seed)

      return new SamplingState({
        seed: next,
        scored: Arr.append(state.scored, new ScoredDemo({ score: next, demo }))
      })
    }
  ).scored

  return Arr.take(
    Arr.map(Arr.sort(scored, scoredDemoOrder), (entry) => entry.demo),
    normalizedK
  )
}

/**
 * Replaces demonstrations across a module ownership tree with one labeled subset.
 *
 * @remarks
 * Entries without `output` are ignored. The remaining examples receive seeded
 * pseudo-random scores, are sorted by score, and are truncated to the normalized
 * `k`. The same selected array replaces demonstrations on the root and every
 * owned child parameter ref. Inputs and outputs are copied without Schema
 * decoding.
 *
 * Ref updates run sequentially and are not rolled back on interruption. The
 * operation performs no model or metric calls and returns the supplied module.
 *
 * @typeParam I - Root module input fields, used only to retain its type.
 * @typeParam O - Root module output fields, used only to retain its type.
 * @param options - Module tree, source examples, selection cap, and seed.
 * @returns The supplied module after all reachable parameter refs are updated.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al. (2023)}
 * @since 0.1.0
 * @category constructors
 */
export const labeledFewShot = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: LabeledFewShotOptions<I, O>) =>
  Effect.gen(function*() {
    const seed = Option.getOrElse(Option.fromNullable(options.seed), () => 1)
    const demos = yield* Effect.sync(() => selectRandomDemos(labeledDemos(options.trainset), options.k, seed))
    const refs = collectModuleParamRefs(options.module)

    yield* Effect.forEach(
      refs,
      (entry) => Ref.update(entry.params, (params) => withModuleParamsDemos(params, demos)),
      { discard: true }
    )

    return options.module
  })
