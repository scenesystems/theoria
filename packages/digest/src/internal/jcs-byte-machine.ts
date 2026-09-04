/** Cooperative canonical UTF-8 segment assembly. @internal */

import { Array as Arr, Chunk, Effect, MutableList, MutableRef, Option } from "effect"

import { encodeUtf8Unchecked } from "./unicode.js"

const SEGMENT_BATCH = 4
const HOST_YIELD_BATCHES = 8
const CONTROL_TOKENS: ReadonlyArray<number> = Arr.makeBy(SEGMENT_BATCH, (index) => index)

const cooperate = (batches: MutableRef.MutableRef<number>): Effect.Effect<void> =>
  Effect.zipRight(
    Effect.yieldNow(),
    Effect.suspend(() => {
      const next = MutableRef.get(batches) + 1
      MutableRef.set(batches, next % HOST_YIELD_BATCHES)
      return next === HOST_YIELD_BATCHES ? Effect.sleep(0) : Effect.void
    })
  )

export const encodeCanonicalSegments = (segments: Chunk.Chunk<string>): Effect.Effect<Uint8Array> =>
  Effect.suspend(() => {
    const encoded = MutableList.empty<Uint8Array>()
    const total = MutableRef.make(0)
    const encodeBatches = MutableRef.make(0)
    return Effect.flatMap(
      Effect.iterate(0, {
        while: (at) => at < Chunk.size(segments),
        body: (at) =>
          Effect.flatMap(
            Effect.sync(() =>
              Arr.reduce(CONTROL_TOKENS, at, (next) => {
                if (next === Chunk.size(segments)) return next
                const bytes = encodeUtf8Unchecked(Chunk.unsafeGet(segments, next))
                MutableList.append(encoded, bytes)
                MutableRef.update(total, (length) => length + bytes.length)
                return next + 1
              })
            ),
            (next) => next < Chunk.size(segments) ? Effect.as(cooperate(encodeBatches), next) : Effect.succeed(next)
          )
      }),
      () => {
        const output = new Uint8Array(MutableRef.get(total))
        const offset = MutableRef.make(0)
        const copyBatches = MutableRef.make(0)
        return Effect.as(
          Effect.iterate(0, {
            while: (copied) => copied < Chunk.size(segments),
            body: (copied) =>
              Effect.flatMap(
                Effect.sync(() =>
                  Arr.reduce(CONTROL_TOKENS, copied, (next) =>
                    next === Chunk.size(segments)
                      ? next
                      : Option.match(Option.fromNullable(MutableList.shift(encoded)), {
                        onNone: () => Chunk.size(segments),
                        onSome: (bytes) => {
                          output.set(bytes, MutableRef.get(offset))
                          MutableRef.update(offset, (at) => at + bytes.length)
                          return next + 1
                        }
                      }))
                ),
                (next) => next < Chunk.size(segments) ? Effect.as(cooperate(copyBatches), next) : Effect.succeed(next)
              )
          }),
          output
        )
      }
    )
  })
