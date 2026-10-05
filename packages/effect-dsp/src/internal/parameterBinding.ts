/** Fiber-local immutable parameter overlays and root-relative owner paths. */
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
const Owners = Context.Reference<ReadonlyArray<readonly [Ref.Ref<ModuleParameters>, Predictor.Id]>>(
  "@scenesystems/effect-dsp/internal/parameterBinding/Owners",
  {
    defaultValue: Arr.empty
  }
)

// Ref values are structurally equal in Effect 4; ownership requires identity.
const ownerPath = (
  owners: ReadonlyArray<readonly [Ref.Ref<ModuleParameters>, Predictor.Id]>,
  params: Ref.Ref<ModuleParameters>
) => Option.map(Arr.findFirst(owners, ([ref]) => ref === params), ([, id]) => id)

/** Root-relative predictor identity, falling back to its standalone name. @internal */
export const path = (params: Ref.Ref<ModuleParameters>, name: string) =>
  Effect.map(Owners, (owners) => Option.getOrElse(ownerPath(owners, params), () => name))

/** @internal */
export const withOwners = (predictors: Iterable<Predictor.Ref>) => <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(
    Owners,
    (outer) =>
      Effect.provideService(
        effect.pipe(withDefaults(Record.fromEntries(Arr.flatMap(Arr.fromIterable(predictors), (entry) =>
          Option.toArray(Option.map(entry.boundParameters, (params) =>
            Tuple.make(
              Option.getOrElse(ownerPath(outer, entry.params), () =>
                entry.id),
              params
            ))))))),
        Owners,
        Arr.dedupeWith(
          Arr.appendAll(
            outer,
            Arr.map(Arr.fromIterable(predictors), (entry) =>
              Tuple.make(entry.params, entry.id))
          ),
          ([left], [right]) => left === right
        )
      )
  )

/** @internal */
export const read = Effect.fnUntraced(function*(params: Ref.Ref<ModuleParameters>, name: string) {
  const owners = yield* Owners
  const binding = yield* Binding
  const id = Option.getOrElse(ownerPath(owners, params), () => name)
  return yield* Option.match(Option.flatMap(binding, (set) => Record.get(set, id)), {
    onNone: () => Ref.get(params),
    onSome: Effect.succeed
  })
})

/** @internal */
export const mapParameters = (predictors: Iterable<Predictor.Ref>, f: (params: ModuleParameters) => ModuleParameters) =>
  Effect.gen(function*() {
    const owners = yield* Owners
    return Record.fromEntries(
      yield* Effect.forEach(predictors, (entry) =>
        read(entry.params, entry.id).pipe(Effect.map((params) =>
          Tuple.make(
            Option.getOrElse(ownerPath(owners, entry.params), () => entry.id),
            f(params)
          )
        )))
    )
  }).pipe(withOwners(predictors))

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
