/**
 * Lexically scoped collector services.
 *
 * @since 0.1.0
 * @internal
 */
import type { Chunk, Ref } from "effect"
import { Context, Data, Option } from "effect"
import type { Call, Entry } from "../../Trace.js"

export class EntryCollections extends Data.Class<{
  readonly current: Ref.Ref<Chunk.Chunk<Entry>>
  readonly ancestors: Chunk.Chunk<Ref.Ref<Chunk.Chunk<Entry>>>
}> {}

export const EntryCollector = Context.Reference<Option.Option<EntryCollections>>(
  "@scenesystems/effect-dsp/internal/trace/refs/EntryCollector",
  { defaultValue: Option.none }
)

export class CallCollections extends Data.Class<{
  readonly current: Ref.Ref<Chunk.Chunk<Call>>
  readonly ancestors: Chunk.Chunk<Ref.Ref<Chunk.Chunk<Call>>>
}> {}

export const CallCollector = Context.Reference<Option.Option<CallCollections>>(
  "@scenesystems/effect-dsp/internal/trace/refs/CallCollector",
  { defaultValue: Option.none }
)
