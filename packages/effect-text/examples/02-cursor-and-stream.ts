/**
 * Cursor And Stream — pure incremental line walking.
 *
 * What this shows: `initialCursor`, `layoutNextLine`, and `streamLines` over
 * a single prepared handle.
 *
 * Feature Type Links:
 * - {@link Text.LayoutCursorType}
 * - {@link Text.layoutNextLine}
 * - {@link Text.streamLines}
 *
 * Run: bun run packages/effect-text/examples/02-cursor-and-stream.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { BunContext } from "@effect/platform-bun"
import { Chunk, Effect, Option, Stream } from "effect"

import { Text } from "effect-text"

const request = {
  maxWidth: 95,
  lineHeight: 18
}

const program = Effect.gen(function*() {
  const prepared = yield* Text.prepare({
    text: "Cursor stepping and stream projection stay pure after prepare time.",
    font: { family: "Mono", size: 14 },
    whiteSpace: "normal"
  })

  const first = Text.layoutNextLine(prepared, request, Text.initialCursor())
  const second = Option.flatMap(first, ([, cursor]) => Text.layoutNextLine(prepared, request, cursor))
  const streamed = yield* Text.streamLines(prepared, request).pipe(
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

  yield* Effect.log("cursor and stream example", {
    first: Option.match(first, {
      onNone: () => "none",
      onSome: ([line, cursor]) => ({ line, cursor })
    }),
    second: Option.match(second, {
      onNone: () => "none",
      onSome: ([line, cursor]) => ({ line, cursor })
    }),
    streamed
  })
}).pipe(
  Effect.provide(Text.TextLayoutLive),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(program)
