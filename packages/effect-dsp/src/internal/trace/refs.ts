/**
 * Lexically scoped collector services.
 *
 * @since 0.1.0
 * @internal
 */
import type { Chunk, Ref } from "effect"
import { Context, Data } from "effect"
import type { Call, Entry } from "../../Trace.js"

export class EntryCollections extends Data.Class<{
  readonly current: Ref.Ref<Chunk.Chunk<Entry>>
  readonly ancestors: Chunk.Chunk<Ref.Ref<Chunk.Chunk<Entry>>>
}> {}

export class EntryCollector extends Context.Tag("effect-dsp/Trace/EntryCollector")<
  EntryCollector,
  EntryCollections
>() {}

export class CallCollections extends Data.Class<{
  readonly current: Ref.Ref<Chunk.Chunk<Call>>
  readonly ancestors: Chunk.Chunk<Ref.Ref<Chunk.Chunk<Call>>>
}> {}

export class CallCollector extends Context.Tag("effect-dsp/Trace/CallCollector")<
  CallCollector,
  CallCollections
>() {}
