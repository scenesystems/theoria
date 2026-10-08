/** Optional predictor memoization; backend failures never fail prediction. @internal */
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import * as ModelIdentity from "@scenesystems/effect-lm/ModelIdentity"
import * as ModelSettings from "@scenesystems/effect-lm/ModelSettings"
import { Boolean, Cause, Effect, Option, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Cache from "../../../Cache.js"
import { ModuleParameters } from "../../../ModuleParameters.js"
import * as Payload from "../../../Payload.js"
import * as Signature from "../../../Signature.js"
import { emptyUsage } from "../../../Trace.js"
import * as LocalIdentities from "../../cache/identities.js"
import { ForwardExecution, type ForwardOptions } from "./model.js"

const Cached = Schema.Struct({
  traceOutput: Payload.Payload,
  promptText: Schema.String,
  rawResponse: Schema.String
})
const RuntimeIdentity = Schema.Union([ModelIdentity.Identity, Schema.String])
const hash = (value: typeof RuntimeIdentity.Type) =>
  ContentDigest.fromSchema(RuntimeIdentity, value).pipe(Effect.map(ContentDigest.toString))

/**
 * Declared identities are durable. Anonymous runtimes are identified by object
 * pair only inside the registry scope owned by the installed Cache layer; with
 * no registry they are not memoized, so no identity is invented per call.
 */
const runtimeIdentity = Effect.gen(function*() {
  const declared = yield* ModelIdentity.Current
  return yield* Option.match(declared, {
    onSome: (identity) => Effect.succeedSome<typeof RuntimeIdentity.Type>(identity),
    onNone: () =>
      Effect.gen(function*() {
        const registry = yield* Effect.serviceOption(LocalIdentities.LocalIdentities)
        return yield* Option.match(registry, {
          onNone: () => Effect.succeedNone,
          onSome: (service) =>
            Effect.gen(function*() {
              const model = yield* LanguageModel.LanguageModel
              const binder = yield* ModelBinder.Current
              return Option.some<typeof RuntimeIdentity.Type>(yield* LocalIdentities.identify(service, model, binder))
            })
        })
      })
  })
})

const warn = (key: unknown) =>
  Effect.logWarning("Predictor cache operation failed").pipe(Effect.annotateLogs({ cacheKey: key }))

const optional = <A, E, R>(operation: Effect.Effect<A, E, R>, key: unknown) =>
  operation.pipe(
    Effect.asSome,
    Effect.catchCause((cause) =>
      Boolean.match(Cause.hasInterrupts(cause), {
        onFalse: () => warn(key).pipe(Effect.as(Option.none<A>())),
        onTrue: () => Effect.interrupt
      })
    )
  )

const memoized = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>(
  service: Cache.Cache["Service"],
  runtime: typeof RuntimeIdentity.Type,
  options: ForwardOptions<I, O>,
  request: ModelBinder.Request,
  predictorId: string,
  compute: Effect.Effect<ForwardExecution<Schema.Struct.Type<O>>, E, R>
) =>
  Effect.gen(function*() {
    const prepared = yield* optional(
      Effect.gen(function*() {
        const signatureDigest = yield* Signature.digest(options.signature, options.parameters)
        return yield* Cache.key(
          new Cache.KeyRequest({
            moduleFingerprint: options.moduleName,
            runtimeFingerprint: yield* hash(runtime),
            inputSchema: Schema.toEncoded(options.signature.inputSchema),
            parametersSchema: ModuleParameters,
            input: yield* Schema.encodeEffect(options.signature.inputSchema)(options.input),
            parameters: options.parameters,
            settings: ModelSettings.merge(yield* ModelSettings.Current, request.settings),
            role: request.role,
            predictorId,
            signatureDigest
          })
        )
      }),
      predictorId
    )
    return yield* Option.match(prepared, {
      onNone: () => compute,
      onSome: (key) =>
        Effect.gen(function*() {
          const hit = Option.flatten(yield* optional(Effect.suspend(() => service.get(key, Cached)), key))
          const restored = yield* Option.match(hit, {
            onNone: () => Effect.succeedNone,
            onSome: (value) =>
              optional(Payload.decode(options.outputSchema, value.traceOutput), key).pipe(
                Effect.map(
                  Option.map((output) => new ForwardExecution({ ...value, output, usage: emptyUsage.tokens }))
                )
              )
          })
          return yield* Option.match(restored, {
            onNone: () =>
              compute.pipe(
                Effect.tap((result) => optional(Effect.suspend(() => service.set(key, Cached, result)), key))
              ),
            onSome: (execution) => Effect.succeed(execution)
          })
        })
    })
  })

/** Called inside the binder, so declared model identity is already selected. @internal */
export const cached = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>(
  options: ForwardOptions<I, O>,
  request: ModelBinder.Request,
  predictorId: string,
  compute: Effect.Effect<ForwardExecution<Schema.Struct.Type<O>>, E, R>
) =>
  Effect.gen(function*() {
    const cache = yield* Effect.serviceOption(Cache.Cache)
    return yield* Option.match(cache, {
      onNone: () => compute,
      onSome: (service) =>
        Effect.gen(function*() {
          const identity = yield* runtimeIdentity
          return yield* Option.match(identity, {
            onNone: () => compute,
            onSome: (runtime) => memoized(service, runtime, options, request, predictorId, compute)
          })
        })
    })
  })
