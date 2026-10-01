/**
 * Recording operations used by traced model execution.
 *
 * @since 0.1.0
 */
import { Chunk, Effect, Option, Ref } from "effect"
import type { Call, Entry } from "../../Trace.js"
import { CallCollector, EntryCollector } from "./refs.js"

/**
 * Appends an entry to the current tracing scope and each lexical ancestor.
 * Outside a tracing scope this operation does nothing.
 *
 * @param entry - Complete successful invocation record.
 *
 * @since 0.1.0
 * @category combinators
 */
export const append = (entry: Entry): Effect.Effect<void> =>
  Effect.serviceOption(EntryCollector).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.void,
        onSome: (collections) =>
          Effect.forEach(
            Chunk.prepend(collections.ancestors, collections.current),
            (ref) => Ref.update(ref, (entries) => Chunk.append(entries, entry)),
            { discard: true }
          )
      })
    ),
    Effect.uninterruptible
  )

/**
 * Appends one invocation call to the current call scope and each lexical ancestor.
 * Outside call or usage scopes this operation does nothing.
 *
 * @param call - Per-invocation evidence without prompt or failure contents.
 *
 * @since 0.4.0
 * @category combinators
 */
export const appendCall = (call: Call): Effect.Effect<void> =>
  Effect.serviceOption(CallCollector).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.void,
        onSome: (collections) =>
          Effect.forEach(
            Chunk.prepend(collections.ancestors, collections.current),
            (ref) => Ref.update(ref, (calls) => Chunk.append(calls, call)),
            { discard: true }
          )
      })
    ),
    Effect.uninterruptible
  )
