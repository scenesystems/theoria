/**
 * Quick Start — prepare once, lay out many times.
 *
 * What this shows: the smallest end-to-end `effect-text` program using the
 * deterministic live layer and the prepare/layout split.
 *
 * Feature Type Links:
 * - {@link Text.PreparedTextWithSegments}
 * - {@link Text.LayoutSummaryType}
 * - {@link Text.LayoutLineType}
 *
 * Run: bun run packages/effect-text/examples/01-quick-start.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { BunContext } from "@effect/platform-bun"
import { Effect } from "effect"

import { Text } from "effect-text"

const program = Effect.gen(function*() {
  const prepared = yield* Text.prepareWithSegments({
    text: "Effect keeps prepare effectful and layout pure.",
    font: { family: "Mono", size: 16 },
    whiteSpace: "normal"
  })

  const narrowSummary = Text.layout(prepared, {
    maxWidth: 120,
    lineHeight: 20
  })

  const wideLines = Text.layoutLines(prepared, {
    maxWidth: 220,
    lineHeight: 20
  })

  yield* Effect.log("effect-text quick start", {
    narrowSummary,
    wideLines
  })
}).pipe(
  Effect.provide(Text.TextLayoutLive),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(program)
