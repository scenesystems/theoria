import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Layer, Option, Ref, Stream } from "effect"
import { Contracts, Text } from "../../src/index.js"
import type { LayoutRequestType } from "../../src/Text/schema.js"

const makeTestContext = Effect.gen(function*() {
  const measurements = yield* Ref.make(0)
  const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
    measure: (_font, text: string) => Ref.update(measurements, (count) => count + 1).pipe(Effect.as(text.length * 5))
  })

  return Layer.mergeAll(
    Text.WordSegmenterLive,
    Text.EngineProfileLive,
    Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
  )
})

const collectCursorLines = (
  prepared: Text.PreparedTextWithSegments,
  request: LayoutRequestType,
  cursor = Text.initialCursor()
): ReadonlyArray<Text.LayoutLineType> =>
  Option.match(Text.layoutNextLine(prepared, request, cursor), {
    onNone: () => [],
    onSome: ([line, nextCursor]) => [line, ...collectCursorLines(prepared, request, nextCursor)]
  })

describe("Text hot-path contracts", () => {
  it.effect("streamLines emits the same sequence as repeated layoutNextLine", () =>
    Effect.gen(function*() {
      const layer = yield* makeTestContext
      const prepared = yield* Text.prepareWithSegments({
        text: "one two three four five six",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))
      const request: LayoutRequestType = { maxWidth: 35, lineHeight: 12 }
      const streamed = yield* Text.streamLines(prepared, request).pipe(
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray)
      )
      const cursorLines = collectCursorLines(prepared, request)

      expect(streamed).toEqual(cursorLines)
    }))
})
