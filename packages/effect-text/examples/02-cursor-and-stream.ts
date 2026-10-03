/**
 * Compares cursor stepping with lazy stream projection over one prepared handle.
 *
 * Run with `bun run packages/effect-text/examples/02-cursor-and-stream.ts`.
 */
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import { Effect, Layer, Option, Stream } from "effect"

import { Text } from "@scenesystems/effect-text"

const request = {
  maxWidth: 95,
  lineHeight: 18
}

const program = Effect.gen(function*() {
  const prepared = yield* Text.prepareWithSegments({
    text: "Cursor stepping and stream projection stay pure after prepare time.",
    font: { family: "Mono", size: 14 },
    whiteSpace: "normal"
  })

  const first = Text.nextLine(prepared, request, Text.start)
  const second = Option.flatMap(first, ([, cursor]) => Text.nextLine(prepared, request, cursor))
  const streamed = yield* Text.stream(prepared, request).pipe(
    Stream.runCollect
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
}).pipe(Effect.provide(Layer.merge(Text.layer, BunServices.layer)))

BunRuntime.runMain(program)
