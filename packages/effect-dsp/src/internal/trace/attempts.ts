/** Lexically scoped predictor-attempt evidence. @internal */
import { Chunk, Context, Data, Effect, Option, Ref, Schema, Tuple } from "effect"
import { defaultIdGenerator } from "effect/ai/IdGenerator"
import type { Attempt } from "../../Trace.js"
import { Execution } from "../../Trace.js"

class Collections extends Data.Class<{
  readonly current: Ref.Ref<Chunk.Chunk<Attempt>>
  readonly ancestors: Chunk.Chunk<Ref.Ref<Chunk.Chunk<Attempt>>>
}> {}
const Collector = Context.Reference<Option.Option<Collections>>(
  "@scenesystems/effect-dsp/internal/trace/attempts",
  { defaultValue: Option.none }
)

/** Allocate once at the predictor boundary, never once per retry. @internal */
export const executionId = defaultIdGenerator.generateId().pipe(Effect.map((id) => Schema.decodeSync(Execution.Id)(id)))

/** @internal */
export const appendAttempt = (attempt: Attempt) =>
  Collector.pipe(
    Effect.flatMap(Option.match({
      onNone: () => Effect.void,
      onSome: (collections) =>
        Effect.forEach(
          Chunk.prepend(collections.ancestors, collections.current),
          (ref) => Ref.update(ref, (attempts) => Chunk.append(attempts, attempt)),
          { discard: true }
        )
    })),
    Effect.uninterruptible
  )

/** @internal */
export const withAttempts = <A, E, R>(program: Effect.Effect<A, E, R>) =>
  Effect.gen(function*() {
    const parent = yield* Collector
    const current = yield* Ref.make(Chunk.empty<Attempt>())
    const collections = new Collections({
      current,
      ancestors: Option.match(parent, {
        onNone: () => Chunk.empty(),
        onSome: (outer) => Chunk.prepend(outer.ancestors, outer.current)
      })
    })
    const result = yield* program.pipe(Effect.provideService(Collector, Option.some(collections)))
    return Tuple.make(result, yield* Ref.get(current))
  })
