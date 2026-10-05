/**
 * Copies a seeded subset of labeled examples into module parameters.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.1.0
 * @module
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { normalizeDeterministicSeed } from "@scenesystems/effect-search/Sampler"
import { Array as Arr, Data, Effect, Option, Record, Schema, Tuple } from "effect"
import { labeledDemos, type LabeledExamples, selectRandomDemos } from "./internal/labeledFewShot/sampling.js"
import { bound, type Module } from "./Module.js"
import { predictors } from "./ModuleGraph.js"
import { withDemos as withModuleParamsDemos } from "./ModuleParameters.js"
import * as Optimized from "./Optimized.js"
import * as ParameterSet from "./ParameterSet.js"

/** Normalized sampling request and number of selected labeled demonstrations.
 * @since 1.0.0
 * @category models
 */
export class Report extends Schema.Class<Report>("@scenesystems/effect-dsp/LabeledFewShot/Report")({
  k: Schema.Int,
  sampled: Schema.Int,
  seed: Schema.Int
}) {}

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
  /** Program whose optimizable leaves receive demonstrations in a bound copy. */
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
 * `k`. Each unfrozen leaf validates the selected wire values with its own
 * encoded signature. Shared owners are sampled once. Caller refs are unchanged.
 *
 * Incompatible stages fail with a checked ParseError; use trace bootstrapping
 * to derive stage-specific demonstrations. No model or metric calls are performed.
 *
 * @typeParam I - Root module input fields, used only to retain its type.
 * @typeParam O - Root module output fields, used only to retain its type.
 * @param options - Module tree, source examples, selection cap, and seed.
 * @returns A bound program, its immutable parameters, and the sampling report.
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
    const seed = normalizeDeterministicSeed(options.seed ?? 1)
    const k = Numeric.isFinite(options.k) ? Numeric.max(0, Numeric.floor(options.k)) : 0
    const demos = selectRandomDemos(labeledDemos(options.trainset), k, seed)
    const before = yield* ParameterSet.snapshot(options.module)
    const refs = Arr.filter(Arr.fromIterable(predictors(options.module)), (entry) => entry.ownership !== "frozen")
    const replacements = yield* Effect.forEach(refs, (entry) =>
      Effect.forEach(demos, entry.demonstrationCodec.decode).pipe(
        Effect.map((validated) =>
          Tuple.make(entry.id, withModuleParamsDemos(Option.getOrThrow(Record.get(before, entry.id)), validated))
        )
      ))
    const parameters = { ...before, ...Record.fromEntries(replacements) }
    return new Optimized.Result({
      program: bound(options.module, parameters),
      parameters,
      report: new Report({ k, sampled: Arr.length(demos), seed })
    })
  })
