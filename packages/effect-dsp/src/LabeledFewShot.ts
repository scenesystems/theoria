/**
 * Copies a seeded subset of labeled examples into module parameters.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.1.0
 * @module
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Boolean, Data, Effect, Option, Record, Schema, Tuple } from "effect"
import { type LabeledExamples, sampleLabeled } from "./internal/labeledFewShot/sampling.js"
import { bound, type Module } from "./Module.js"
import { predictors } from "./ModuleGraph.js"
import { withDemos as withModuleParametersDemos } from "./ModuleParameters.js"
import * as Optimized from "./Optimized.js"
import * as ParameterSet from "./ParameterSet.js"

/** Normalized sampling request and number of selected labeled demonstrations.
 * @since 0.7.0
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
  /** Program whose trainable predictors receive demonstrations in a bound copy. */
  readonly module: Module<I, O, E, R>
  /** Source examples; entries without labels are ignored. */
  readonly trainset: LabeledExamples
  /** Selection cap, default 16; negative and non-finite values select none. */
  readonly k?: number
  /** Random sampling by default; false selects the first k labeled rows. */
  readonly sample?: boolean
  /** Integer selection seed for CPython-compatible sampling. Defaults to `0`. */
  readonly seed?: number
}> {}

/**
 * Replaces demonstrations with independently sampled per-predictor subsets.
 *
 * @remarks
 * Entries without labels are ignored. Each unfrozen leaf draws without replacement
 * from one CPython-compatible seeded stream, or takes the first k rows when sample is false.
 * Labels are projected onto destination fields and missing output fields mark a
 * demonstration incomplete. Shared predictors are sampled once. Caller refs are unchanged.
 *
 * Incompatible input fields fail with a checked SchemaError; use trace bootstrapping
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
    const requestedSeed = Option.getOrElse(Option.fromUndefinedOr(options.seed), () => 0)
    const seed = Boolean.match(Numeric.isFinite(requestedSeed), {
      onFalse: () => 0,
      onTrue: () => Numeric.truncate(requestedSeed)
    })
    const sampling = yield* PseudoRandom.makeCPython(seed)
    const requested = Option.getOrElse(Option.fromUndefinedOr(options.k), () => 16)
    const k = Boolean.match(Numeric.isFinite(requested), {
      onFalse: () => 0,
      onTrue: () => Numeric.max(0, Numeric.floor(requested))
    })
    const before = yield* ParameterSet.snapshot(options.module)
    const refs = Arr.filter(Arr.fromIterable(predictors(options.module)), (entry) => !entry.frozen)
    const replacements = yield* Effect.forEach(refs, (entry) =>
      Effect.gen(function*() {
        const selected = yield* sampleLabeled(
          options.trainset,
          k,
          sampling,
          Option.getOrElse(Option.fromUndefinedOr(options.sample), () => true)
        )
        const validated = yield* Effect.forEach(selected, entry.demonstrationCodec.labeled)
        return Tuple.make(
          entry.path,
          withModuleParametersDemos(Option.getOrThrow(Record.get(before, entry.path)), validated)
        )
      }))
    const parameters = { ...before, ...Record.fromEntries(replacements) }
    return new Optimized.Result({
      program: bound(options.module, parameters),
      parameters,
      report: new Report({
        k,
        sampled: Numeric.min(k, Arr.length(Arr.filter(options.trainset, (example) => Option.isSome(example.labels)))),
        seed
      })
    })
  })
