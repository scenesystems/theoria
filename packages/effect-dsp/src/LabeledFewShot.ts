/**
 * Copies a seeded subset of labeled examples into module parameters.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.1.0
 * @module
 */
import { Data, Effect, Option, Ref } from "effect"
import type { Schema } from "effect"
import { labeledDemos, type LabeledExamples, selectRandomDemos } from "./internal/labeledFewShot/sampling.js"
import { collectModuleParamRefs } from "./internal/moduleParameters.js"
import type { Module } from "./Module.js"
import { withDemos as withModuleParamsDemos } from "./ModuleParameters.js"

/**
 * Configures seeded demonstration replacement without model execution.
 *
 * @typeParam I - Root module input fields.
 * @typeParam O - Root module output fields.
 *
 * @since 0.1.0
 * @category models
 */
export class Options<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
> extends Data.Class<{
  /** Module whose root and discovered submodule parameter refs are updated. */
  readonly module: Module<I, O, E, R>
  /** Source examples; entries without `output` are ignored. */
  readonly trainset: LabeledExamples
  /** Selection cap, rounded down; negative and non-finite values select none. */
  readonly k: number
  /** Pseudo-random selection seed. Defaults to `1`. */
  readonly seed?: number
}> {}

/**
 * Replaces demonstrations across a module ownership tree with one labeled subset.
 *
 * @remarks
 * Entries without `output` are ignored. The remaining examples receive seeded
 * pseudo-random scores, are sorted by score, and are truncated to the normalized
 * `k`. The same selected array replaces demonstrations on the root and every
 * owned child parameter ref. Every destination validates the selected wire
 * values with its own encoded signature before any parameters change.
 *
 * Incompatible stages fail with a checked ParseError; use trace bootstrapping
 * to derive stage-specific demonstrations. The final ref updates are
 * uninterruptible. No model or metric calls are performed.
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
export const run = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never
>(options: Options<I, O, E, R>) =>
  Effect.gen(function*() {
    const seed = Option.getOrElse(Option.fromNullable(options.seed), () => 1)
    const demos = selectRandomDemos(labeledDemos(options.trainset), options.k, seed)
    const refs = collectModuleParamRefs(options.module)

    const replacements = yield* Effect.forEach(refs, (entry) =>
      Effect.forEach(demos, entry.demonstrationCodec.decode).pipe(
        Effect.map((validated) =>
          Ref.update(entry.params, (params) => withModuleParamsDemos(params, validated))
        )
      ))
    yield* Effect.all(replacements, { discard: true }).pipe(Effect.uninterruptible)

    return options.module
  })
