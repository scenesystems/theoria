/**
 * Prepares text with the shipped deterministic Layer, then projects the same
 * handle at two widths.
 *
 * Run with `bun run packages/effect-text/examples/01-quick-start.ts`.
 */
import * as BunContext from "@effect/platform-bun/BunContext"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import { Effect, Layer } from "effect"

import { Text } from "@scenesystems/effect-text"

const program = Effect.gen(function*() {
  const prepared = yield* Text.prepareWithSegments({
    text: "Effect keeps prepare effectful and layout pure.",
    font: { family: "Mono", size: 16 },
    whiteSpace: "normal"
  })

  const narrowSummary = Text.summary(prepared, {
    maxWidth: 120,
    lineHeight: 20
  })

  const wideLines = Text.lines(prepared, {
    maxWidth: 220,
    lineHeight: 20
  })

  yield* Effect.log("effect-text quick start", {
    narrowSummary,
    wideLines
  })
}).pipe(Effect.provide(Layer.merge(Text.layer, BunContext.layer)))

BunRuntime.runMain(program)
