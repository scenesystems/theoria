/**
 * Scoped process-local identities for language-model runtimes that declare no
 * ModelIdentity. Entries live exactly as long as the Cache layer that
 * allocated the registry and are cleared when its scope closes.
 *
 * @internal
 */
import type * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { Array as Arr, Context, Data, Effect, Layer, Option, Ref, Tuple } from "effect"
import { defaultIdGenerator } from "effect/ai/IdGenerator"
import type * as LanguageModel from "effect/ai/LanguageModel"

/** One runtime object pair and its process-local identity. @internal */
export class Entry extends Data.Class<{
  readonly model: LanguageModel.LanguageModel
  readonly binder: ModelBinder.Binder
  readonly id: string
}> {}

/** Registry owned by one Cache layer lifetime. @internal */
export class LocalIdentities extends Context.Service<
  LocalIdentities,
  { readonly entries: Ref.Ref<ReadonlyArray<Entry>> }
>()("@scenesystems/effect-dsp/internal/cache/LocalIdentities") {}

/** Allocates an empty registry and releases every entry with the layer scope. @internal */
export const layer: Layer.Layer<LocalIdentities> = Layer.effect(
  LocalIdentities,
  Effect.acquireRelease(
    Ref.make<ReadonlyArray<Entry>>(Arr.empty()),
    (entries) => Ref.set(entries, Arr.empty())
  ).pipe(Effect.map((entries) => ({ entries })))
)

/** Returns the stable identity of one model and binder object pair within the registry. @internal */
export const identify = (
  registry: LocalIdentities["Service"],
  model: LanguageModel.LanguageModel,
  binder: ModelBinder.Binder
): Effect.Effect<string> =>
  Effect.flatMap(defaultIdGenerator.generateId(), (id) =>
    Ref.modify(registry.entries, (entries) =>
      Option.match(
        Arr.findFirst(entries, (entry) => entry.model === model && entry.binder === binder),
        {
          onSome: (entry) => Tuple.make(entry.id, entries),
          onNone: () => Tuple.make(id, Arr.append(entries, new Entry({ model, binder, id })))
        }
      )))
