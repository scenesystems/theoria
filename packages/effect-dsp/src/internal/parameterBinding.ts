/** Fiber-local immutable parameter overlays and root-relative owner paths. */
import { Array as Arr, Context, Effect, HashMap, Option, Record, Ref, Tuple } from "effect"
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
const Owners = Context.Reference<HashMap.HashMap<Ref.Ref<ModuleParameters>, Predictor.Id>>(
  "@scenesystems/effect-dsp/internal/parameterBinding/Owners",
  {
    defaultValue: HashMap.empty
  }
)

/** @internal */
export const withOwners = (predictors: Iterable<Predictor.Ref>) => <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(
    Owners,
    (outer) =>
      Effect.provideService(
        effect.pipe(withDefaults(Record.fromEntries(Arr.flatMap(Arr.fromIterable(predictors), (entry) =>
          Option.toArray(Option.map(entry.boundParameters, (params) =>
            Tuple.make(
              Option.getOrElse(HashMap.get(outer, entry.params), () =>
                entry.id),
              params
            ))))))),
        Owners,
        HashMap.union(
          HashMap.fromIterable(Arr.map(Arr.fromIterable(predictors), (entry) =>
            Tuple.make(entry.params, entry.id))),
          outer
        )
      )
  )

/** @internal */
export const read = Effect.fnUntraced(function*(params: Ref.Ref<ModuleParameters>, name: string) {
  const owners = yield* Owners
  const binding = yield* Binding
  const id = Option.getOrElse(HashMap.get(owners, params), () => name)
  return yield* Option.match(Option.flatMap(binding, (set) => Record.get(set, id)), {
    onNone: () => Ref.get(params),
    onSome: Effect.succeed
  })
})

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
