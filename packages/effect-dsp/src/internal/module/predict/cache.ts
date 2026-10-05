/** Optional predictor memoization; backend failures never fail prediction. @internal */
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import * as ModelIdentity from "@scenesystems/effect-lm/ModelIdentity"
import * as ModelSettings from "@scenesystems/effect-lm/ModelSettings"
import { Array as Arr, Cause, Data, Effect, Option, Ref, Schema, Tuple } from "effect"
import { defaultIdGenerator } from "effect/ai/IdGenerator"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Cache from "../../../Cache.js"
import * as Payload from "../../../Payload.js"
import * as Signature from "../../../Signature.js"
import { emptyUsage } from "../../../Trace.js"
import { effective } from "../../signature/effective.js"
import { ForwardExecution, type ForwardOptions } from "./model.js"

class LocalIdentity extends Data.Class<{
  readonly model: LanguageModel.LanguageModel
  readonly binder: ModelBinder.Binder
  readonly id: string
}> {}
const identities = Ref.makeUnsafe(Arr.empty<LocalIdentity>())

const runtimeIdentity = Effect.gen(function*() {
  const declared = yield* ModelIdentity.Current
  if (Option.isSome(declared)) return declared.value
  const model = yield* LanguageModel.LanguageModel
  const binder = yield* ModelBinder.Current
  const id = yield* defaultIdGenerator.generateId()
  return yield* Ref.modify(identities, (entries) =>
    Option.match(
      Arr.findFirst(entries, (entry) => entry.model === model && entry.binder === binder),
      {
        onSome: (entry) => Tuple.make(entry.id, entries),
        onNone: () => Tuple.make(id, Arr.append(entries, new LocalIdentity({ model, binder, id })))
      }
    ))
})

const Cached = Schema.Struct({
  traceOutput: Payload.Payload,
  promptText: Schema.String,
  rawResponse: Schema.String
})
const hash = (value: unknown) => ContentDigest.fromUnknown("blake3-256", value).pipe(Effect.map(ContentDigest.toString))
const warn = (key: unknown) =>
  Effect.logWarning("Predictor cache operation failed").pipe(Effect.annotateLogs({ cacheKey: key }))

const optional = <A, E, R>(operation: Effect.Effect<A, E, R>, key: unknown) =>
  operation.pipe(
    Effect.asSome,
    Effect.catchCause((cause) =>
      Cause.hasInterrupts(cause) ? Effect.interrupt : warn(key).pipe(Effect.as(Option.none()))
    )
  )

/** Called inside the binder, so declared model identity is already selected. @internal */
export const cached = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>(
  options: ForwardOptions<I, O>,
  request: ModelBinder.Request,
  predictorId: string,
  compute: Effect.Effect<ForwardExecution<Schema.Struct.Type<O>>, E, R>
) =>
  Effect.gen(function*() {
    const cache = yield* Effect.serviceOption(Cache.Cache)
    if (Option.isNone(cache)) return yield* compute
    const prepared = yield* optional(
      Effect.gen(function*() {
        const signature = effective(options.signature, options.parameters)
        const signatureDigest = yield* Signature.digest(signature)
        return yield* Cache.key(
          new Cache.KeyRequest({
            moduleFingerprint: options.moduleName,
            runtimeFingerprint: yield* hash(yield* runtimeIdentity),
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
    if (Option.isNone(prepared)) return yield* compute
    const key = prepared.value
    const hit = Option.flatten(yield* optional(Effect.suspend(() => cache.value.get(key, Cached)), key))
    if (Option.isSome(hit)) {
      const restored = yield* optional(Payload.decode(options.outputSchema, hit.value.traceOutput), key)
      if (Option.isSome(restored)) {
        return new ForwardExecution({ ...hit.value, output: restored.value, usage: emptyUsage.tokens })
      }
    }
    const result = yield* compute
    yield* optional(Effect.suspend(() => cache.value.set(key, Cached, result)), key)
    return result
  })
