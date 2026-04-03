import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Ref } from "effect"

import {
  callExpressionTargets,
  parseTypeScript,
  readProjectFile,
  variableInitializerTexts
} from "../../../../tools/testing/sourceProof.js"
import { Contracts, Text } from "../../src/index.js"

const packageRootUrl = new URL("../../", import.meta.url)

const makeTestContext = Effect.gen(function*() {
  const measurements = yield* Ref.make(0)
  const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
    measure: (_font, text: string) => Ref.update(measurements, (count) => count + 1).pipe(Effect.as(text.length * 5))
  })

  return {
    measurements,
    layer: Layer.mergeAll(
      Text.WordSegmenterLive,
      Text.EngineProfileLive,
      Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
    )
  }
})

const readInitializerTargets = (relativePath: string, variableName: string) =>
  readProjectFile(packageRootUrl, relativePath).pipe(
    Effect.map((source) => {
      const parsed = parseTypeScript(`${variableName}.ts`, source)
      const [initializer = "undefined"] = variableInitializerTexts(parsed, variableName)

      return callExpressionTargets(
        parseTypeScript(`${variableName}.initializer.ts`, `const ${variableName} = ${initializer}`)
      )
    })
  )

describe("Text variable-width contracts", () => {
  it.effect("layoutLinesWith resolves per-line widths without re-preparing text", () =>
    Effect.gen(function*() {
      const { measurements, layer } = yield* makeTestContext
      const request = { maxWidth: 80, lineHeight: 14 }
      const prepared = yield* Text.prepare({
        text: "The quick brown fox jumps over the lazy dog near a stream of flowing water",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))
      const afterPrepare = yield* Ref.get(measurements)
      const projected = Text.layoutLinesWith(prepared, request, (lineIndex) => lineIndex === 0 ? request.maxWidth : 40)
      const uniform = Text.layoutLinesWith(prepared, request, () => request.maxWidth)
      const afterProjection = yield* Ref.get(measurements)

      expect(afterProjection).toBe(afterPrepare)
      expect(projected.length).toBeGreaterThan(uniform.length)
      expect(projected.every((line) => line.width <= (line.index === 0 ? request.maxWidth : 40) + 0.01)).toBe(true)
    }))

  it.effect("variable-width projection does not re-enter measurement or service lookup after preparation", () =>
    Effect.gen(function*() {
      const { measurements, layer } = yield* makeTestContext
      const request = { maxWidth: 90, lineHeight: 14 }
      const prepared = yield* Text.prepare({
        text: "Layout projections should stay pure after preparation finishes.",
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))
      const afterPrepare = yield* Ref.get(measurements)
      const layoutLinesWithTargets = yield* readInitializerTargets("src/Text/layout.ts", "layoutLinesWith").pipe(
        Effect.provide(BunContext.layer)
      )

      const narrow = Text.layoutLinesWith(prepared, request, () => 35)
      const wide = Text.layoutLinesWith(prepared, request, () => request.maxWidth)
      const afterProjection = yield* Ref.get(measurements)

      expect(afterProjection).toBe(afterPrepare)
      expect(narrow.map((line) => line.text)).not.toEqual(wide.map((line) => line.text))
      expect([...layoutLinesWithTargets].sort()).toEqual(["PreparedText.core", "materializeLines"])
    }))
})
