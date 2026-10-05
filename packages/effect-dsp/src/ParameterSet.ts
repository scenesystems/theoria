/**
 * Immutable snapshots of program predictor parameters.
 * @since 0.6.0
 * @module
 */
import { Array as Arr, Effect, Equal, Option, Record, Schema, Tuple } from "effect"
import * as Binding from "./internal/parameterBinding.js"
import type { ComposableModule } from "./Module.js"
import { predictors } from "./ModuleGraph.js"
import { ModuleParameters } from "./ModuleParameters.js"
import * as Predictor from "./Predictor.js"

/** Parameter payload keyed by stable predictor paths. @since 0.6.0 @category schemas */
export const ParameterSet = Schema.Record(Predictor.Id, ModuleParameters)
/** Decoded immutable parameter payload. @since 0.6.0 @category models */
export type ParameterSet = typeof ParameterSet.Type

/** Snapshot selection. @since 0.6.0 @category schemas */
export const SnapshotOptions = Schema.Struct({ optimizable: Schema.optional(Schema.Boolean) })

/** Reads each leaf owner once; frozen owners are optionally excluded.
 * @since 0.6.0
 * @category constructors
 */
export const snapshot = Effect.fnUntraced(function*(root: ComposableModule, options: typeof SnapshotOptions.Type = {}) {
  const selected = Arr.filter(
    Arr.fromIterable(predictors(root)),
    (entry) => !options.optimizable || entry.ownership !== "frozen"
  )
  const entries = yield* Effect.forEach(
    selected,
    (entry) => Binding.read(entry.params, entry.id).pipe(Effect.map((params) => Tuple.make(entry.id, params)))
  ).pipe(
    Binding.withOwners(predictors(root))
  )
  return Record.fromEntries(entries)
})

/** Retains parameters whose predictor path passes the predicate. @since 0.6.0 @category combinators */
export const restrict = (set: ParameterSet, predicate: (id: Predictor.Id) => boolean): ParameterSet =>
  Record.filter(set, (_, id) => predicate(id))

/** Returns added or changed parameter values from the second snapshot. @since 0.6.0 @category combinators */
export const diff = (before: ParameterSet, after: ParameterSet): ParameterSet =>
  Record.filter(after, (value, id) => !Option.exists(Record.get(before, id), (prior) => Equal.equals(prior, value)))
