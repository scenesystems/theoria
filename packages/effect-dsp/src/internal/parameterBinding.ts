/** Fiber-local immutable parameter overlays and root-relative predictor paths. */
import { Array as Arr, Context, Effect, Option, Record, Ref, Tuple } from "effect"
import type { ModuleParameters } from "../ModuleParameters.js"
import type { ParameterSet } from "../ParameterSet.js"
import type * as Predictor from "../Predictor.js"

/** @internal */
export const Binding = Context.Reference<Option.Option<ParameterSet>>(
  "@scenesystems/effect-dsp/internal/parameterBinding",
  {
    defaultValue: Option.none
  }
)
const Predictors = Context.Reference<ReadonlyArray<readonly [Ref.Ref<ModuleParameters>, Predictor.Path]>>(
  "@scenesystems/effect-dsp/internal/parameterBinding/Predictors",
  {
    defaultValue: Arr.empty
  }
)

// Ref values are structurally equal in Effect 4; shared predictors require identity.
const predictorPath = (
  predictors: ReadonlyArray<readonly [Ref.Ref<ModuleParameters>, Predictor.Path]>,
  params: Ref.Ref<ModuleParameters>
) => Option.map(Arr.findFirst(predictors, ([ref]) => ref === params), ([, path]) => path)

/** Root-relative predictor identity, falling back to its standalone name. @internal */
export const path = (params: Ref.Ref<ModuleParameters>, name: string) =>
  Effect.map(Predictors, (predictors) => Option.getOrElse(predictorPath(predictors, params), () => name))

/** @internal */
export const withPredictors =
  (predictors: Iterable<Predictor.Predictor>) => <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.flatMap(
      Predictors,
      (outer) =>
        Effect.provideService(
          effect.pipe(withDefaults(Record.fromEntries(Arr.flatMap(Arr.fromIterable(predictors), (entry) =>
            Option.toArray(Option.map(entry.boundParameters, (params) =>
              Tuple.make(
                Option.getOrElse(predictorPath(outer, entry.parameters), () => entry.path),
                params
              ))))))),
          Predictors,
          Arr.dedupeWith(
            Arr.appendAll(
              outer,
              Arr.map(Arr.fromIterable(predictors), (entry) =>
                Tuple.make(entry.parameters, entry.path))
            ),
            ([left], [right]) => left === right
          )
        )
    )

/** @internal */
export const read = Effect.fnUntraced(function*(params: Ref.Ref<ModuleParameters>, name: string) {
  const predictors = yield* Predictors
  const binding = yield* Binding
  const id = Option.getOrElse(predictorPath(predictors, params), () => name)
  return yield* Option.match(Option.flatMap(binding, (set) => Record.get(set, id)), {
    onNone: () => Ref.get(params),
    onSome: Effect.succeed
  })
})

/** @internal */
export const mapParameters = (
  predictors: Iterable<Predictor.Predictor>,
  f: (params: ModuleParameters) => ModuleParameters
) =>
  Effect.gen(function*() {
    const outer = yield* Predictors
    return Record.fromEntries(
      yield* Effect.forEach(predictors, (entry) =>
        read(entry.parameters, entry.path).pipe(Effect.map((params) =>
          Tuple.make(
            Option.getOrElse(predictorPath(outer, entry.parameters), () =>
              entry.path),
            f(params)
          )
        )))
    )
  }).pipe(withPredictors(predictors))

/** @internal */
export const withParameters = (parameters: ParameterSet) => <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(
    Binding,
    (outer) =>
      Effect.provideService(effect, Binding, Option.some({ ...Option.getOrElse(outer, () => ({})), ...parameters }))
  )

/** Bound defaults yield to an explicit invocation overlay. @internal */
export const withDefaults = (parameters: ParameterSet) => <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(
    Binding,
    (outer) =>
      Effect.provideService(effect, Binding, Option.some({ ...parameters, ...Option.getOrElse(outer, () => ({})) }))
  )
