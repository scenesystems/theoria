import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Order } from "effect"
import { Text } from "effect-text"
import * as Arr from "effect/Array"

import { corpus } from "../../app/contracts/corpus.js"
import type { Obstacle } from "../../app/contracts/obstacle.js"
import { customTextScene } from "../../app/contracts/reflow-scenes.js"
import { fontDescriptorFor, semanticsFor } from "../../app/contracts/text.js"
import {
  reflowMinWidthFor,
  reflowSliderMaxWidth,
  reflowStageFrameBorderPx,
  reflowStageHorizontalInsetPx,
  resolveReflowStageMaxWidth,
  resolveReflowStageWidth
} from "../../app/web/atoms/reflow.js"
import { projectObstacleTextLayout } from "../../app/web/text/obstacleProjection.js"

const obstacleLineStartOrder = Order.mapInput(
  Order.number,
  (obstacle: { readonly lineStart: number }) => obstacle.lineStart
)

const nonOverlappingBands = (
  obstacles: ReadonlyArray<{ readonly lineStart: number; readonly lineSpan: number }>
): boolean =>
  Arr.reduce(
    obstacles,
    { previousEndLine: 0, valid: true, seen: 0 },
    (state, obstacle) => ({
      previousEndLine: obstacle.lineStart + obstacle.lineSpan,
      valid: state.valid && (state.seen === 0 || obstacle.lineStart >= state.previousEndLine),
      seen: state.seen + 1
    })
  ).valid

const spansOverlap = (
  a: { readonly lineStart: number; readonly lineSpan: number },
  b: { readonly lineStart: number; readonly lineSpan: number }
): boolean => a.lineStart < b.lineStart + b.lineSpan && b.lineStart < a.lineStart + a.lineSpan

const sameTopPx = (
  left: { readonly topPx: number },
  right: { readonly topPx: number }
): boolean => left.topPx === right.topPx

const reflowTestFont = fontDescriptorFor(semanticsFor("card-summary"))

describe("Reflow projection (pure layout)", () => {
  it.effect("assigns each built-in corpus a distinct semantic obstacle scene", () =>
    Effect.gen(function*() {
      const emptySignatures: ReadonlyArray<string> = []
      const sceneSignatures = Arr.map(
        corpus,
        (entry) => `${entry.id}:${Arr.map(entry.scene.obstacles, (obstacle) => obstacle.id).join("|")}`
      )
      const uniqueSignatures = Arr.reduce(
        sceneSignatures,
        emptySignatures,
        (acc, signature) => (acc.includes(signature) ? acc : Arr.append(acc, signature))
      )

      expect(Arr.every(corpus, (entry) => entry.scene.obstacles.length >= 3)).toBe(true)
      expect(uniqueSignatures.length).toBe(corpus.length)
    }))

  it.effect("resolves stage width from the measured viewport before projecting text", () =>
    Effect.gen(function*() {
      const viewportWidth = 320
      const constrainedViewportWidth = 140
      const expectedStageWidth = viewportWidth - (reflowStageHorizontalInsetPx * 2) - (reflowStageFrameBorderPx * 2)
      const constrainedStageWidth = resolveReflowStageMaxWidth(constrainedViewportWidth)

      expect(resolveReflowStageMaxWidth(viewportWidth)).toBe(expectedStageWidth)
      expect(resolveReflowStageWidth(reflowSliderMaxWidth, viewportWidth)).toBe(expectedStageWidth)
      expect(resolveReflowStageWidth(96, constrainedViewportWidth)).toBe(reflowMinWidthFor(constrainedStageWidth))
    }))

  it.effect("prepares corpus text and produces lines for a given width", () =>
    Effect.gen(function*() {
      const entry = corpus[0]!
      const prepared = yield* Text.prepareWithSegments({
        text: entry.text,
        font: reflowTestFont,
        whiteSpace: "normal"
      })

      const lines = Text.layoutLines(prepared, { maxWidth: 300, lineHeight: 24 })
      const summary = Text.layout(prepared, { maxWidth: 300, lineHeight: 24 })

      expect(lines.length).toBeGreaterThan(0)
      expect(summary.lineCount).toBe(lines.length)
      expect(summary.height).toBe(lines.length * 24)
    }).pipe(Effect.provide(Text.TextLayoutLive)))

  it.effect("produces different line counts at different widths", () =>
    Effect.gen(function*() {
      const entry = corpus[0]!
      const prepared = yield* Text.prepareWithSegments({
        text: entry.text,
        font: reflowTestFont,
        whiteSpace: "normal"
      })

      const narrowLines = Text.layoutLines(prepared, { maxWidth: 150, lineHeight: 24 })
      const wideLines = Text.layoutLines(prepared, { maxWidth: 800, lineHeight: 24 })

      expect(narrowLines.length).toBeGreaterThan(wideLines.length)
    }).pipe(Effect.provide(Text.TextLayoutLive)))

  it.effect("reuses prepared text across multiple layout calls", () =>
    Effect.gen(function*() {
      const entry = corpus[0]!
      const prepared = yield* Text.prepareWithSegments({
        text: entry.text,
        font: { family: "system-ui", size: 16, weight: 400 },
        whiteSpace: "normal"
      })

      const summaryA = Text.layout(prepared, { maxWidth: 300, lineHeight: 24 })
      const summaryB = Text.layout(prepared, { maxWidth: 300, lineHeight: 24 })

      expect(summaryA.lineCount).toBe(summaryB.lineCount)
      expect(summaryA.height).toBe(summaryB.height)
      expect(summaryA.maxLineWidth).toBe(summaryB.maxLineWidth)
    }).pipe(Effect.provide(Text.TextLayoutLive)))

  it.effect("line heights match computed container height", () =>
    Effect.gen(function*() {
      const entry = corpus[0]!
      const prepared = yield* Text.prepareWithSegments({
        text: entry.text,
        font: { family: "system-ui", size: 16, weight: 400 },
        whiteSpace: "normal"
      })

      const lh = 24
      const lines = Text.layoutLines(prepared, { maxWidth: 250, lineHeight: lh })
      const summary = Text.layout(prepared, { maxWidth: 250, lineHeight: lh })

      expect(summary.height).toBe(lines.length * lh)

      const lastLine = lines[lines.length - 1]
      expect(lastLine).toBeDefined()
      expect(lastLine!.index * lh).toBeLessThan(summary.height)
    }).pipe(Effect.provide(Text.TextLayoutLive)))

  it.effect("projects obstacle-aware lines from the same prepared text handle", () =>
    Effect.gen(function*() {
      const entry = corpus[0]!
      const prepared = yield* Text.prepareWithSegments({
        text: entry.text,
        font: { family: "system-ui", size: 16, weight: 400 },
        whiteSpace: "normal"
      })

      const request = { maxWidth: 220, lineHeight: 24 }
      const baselineSummary = Text.layout(prepared, request)
      const projection = projectObstacleTextLayout({
        baselineSummary,
        obstacles: entry.scene.obstacles,
        prepared,
        request
      })

      expect(projection.obstacles.length).toBe(entry.scene.obstacles.length)
      expect(projection.effectiveWidthPx).toBeLessThanOrEqual(request.maxWidth)
      expect(projection.summary.lineCount).toBeGreaterThanOrEqual(baselineSummary.lineCount)
      expect(projection.canvasHeightPx).toBeGreaterThanOrEqual(projection.summary.height)
    }).pipe(Effect.provide(Text.TextLayoutLive)))

  it.effect("never assigns a projected line to a rail narrower than that line's measured width", () =>
    Effect.gen(function*() {
      const entry = corpus[0]!
      const prepared = yield* Text.prepareWithSegments({
        text: entry.text,
        font: reflowTestFont,
        whiteSpace: "normal"
      })

      const request = {
        maxWidth: resolveReflowStageWidth(271, 1200, true, entry.scene.obstacles),
        lineHeight: 24
      }
      const baselineSummary = Text.layout(prepared, request)
      const projection = projectObstacleTextLayout({
        baselineSummary,
        obstacles: entry.scene.obstacles,
        prepared,
        request
      })

      expect(Arr.every(projection.lines, (line) => line.width <= line.availableWidthPx)).toBe(true)
    }).pipe(Effect.provide(Text.TextLayoutLive)))

  it.effect("applies fixed opposite-side obstacles within the same vertical band", () =>
    Effect.gen(function*() {
      const entry = corpus[0]!
      const constrainedObstacles: ReadonlyArray<Obstacle> = [
        {
          badge: "RIGHT",
          detail: "Shared band",
          id: "banded-right-obstacle",
          label: "Pull Quote",
          widthPx: 48,
          heightPx: 96,
          topPx: 96,
          placement: "right",
          tone: "text",
          variant: "quote"
        },
        {
          badge: "LEFT",
          detail: "Shared band",
          id: "banded-left-obstacle",
          label: "Sidebar",
          widthPx: 48,
          heightPx: 96,
          topPx: 104,
          placement: "left",
          tone: "math",
          variant: "panel"
        }
      ]
      const prepared = yield* Text.prepareWithSegments({
        text: entry.text,
        font: { family: "system-ui", size: 16, weight: 400 },
        whiteSpace: "normal"
      })

      const request = { maxWidth: 220, lineHeight: 24 }
      const baselineSummary = Text.layout(prepared, request)
      const projection = projectObstacleTextLayout({
        baselineSummary,
        obstacles: constrainedObstacles,
        prepared,
        request
      })
      const leftObstacle = Arr.findFirst(projection.obstacles, (obstacle) => obstacle.id === "banded-left-obstacle")
      const rightObstacle = Arr.findFirst(projection.obstacles, (obstacle) => obstacle.id === "banded-right-obstacle")

      expect(Option.isSome(leftObstacle)).toBe(true)
      expect(Option.isSome(rightObstacle)).toBe(true)
      expect(
        Option.zipWith(leftObstacle, rightObstacle, (left, right) => spansOverlap(left, right)).pipe(
          Option.getOrElse(() => false)
        )
      ).toBe(true)
      expect(
        Arr.every(
          projection.lines,
          (line) => line.leftInsetPx + line.availableWidthPx + line.rightInsetPx <= request.maxWidth
        )
      ).toBe(true)
    }).pipe(Effect.provide(Text.TextLayoutLive)))

  it.effect("keeps default obstacle tops stable as width changes", () =>
    Effect.gen(function*() {
      const entry = corpus.find((e) => e.id === "product-copy")!
      const prepared = yield* Text.prepareWithSegments({
        text: entry.text,
        font: reflowTestFont,
        whiteSpace: "normal"
      })

      const narrowRequest = { maxWidth: 323, lineHeight: 24 }
      const wideRequest = { maxWidth: 360, lineHeight: 24 }
      const narrowProjection = projectObstacleTextLayout({
        baselineSummary: Text.layout(prepared, narrowRequest),
        obstacles: entry.scene.obstacles,
        prepared,
        request: narrowRequest
      })
      const wideProjection = projectObstacleTextLayout({
        baselineSummary: Text.layout(prepared, wideRequest),
        obstacles: entry.scene.obstacles,
        prepared,
        request: wideRequest
      })
      const narrowQuote = Arr.findFirst(narrowProjection.obstacles, (obstacle) =>
        obstacle.id === "product-customer-quote")
      const wideQuote = Arr.findFirst(wideProjection.obstacles, (obstacle) =>
        obstacle.id === "product-customer-quote")
      const narrowChecklist = Arr.findFirst(narrowProjection.obstacles, (obstacle) =>
        obstacle.id === "product-proof-checklist")
      const wideChecklist = Arr.findFirst(wideProjection.obstacles, (obstacle) =>
        obstacle.id === "product-proof-checklist")

      expect(
        Option.zipWith(narrowQuote, wideQuote, (left, right) =>
          sameTopPx(left, right)).pipe(
            Option.getOrElse(() =>
              false
            )
          )
      ).toBe(true)
      expect(
        Option.zipWith(narrowChecklist, wideChecklist, (left, right) =>
          sameTopPx(left, right)).pipe(
            Option.getOrElse(() => false)
          )
      ).toBe(true)
    }).pipe(Effect.provide(Text.TextLayoutLive)))

  it.effect("packs same-side obstacles into non-overlapping vertical bands", () =>
    Effect.gen(function*() {
      const entry = corpus[0]!
      const prepared = yield* Text.prepareWithSegments({
        text: entry.text,
        font: reflowTestFont,
        whiteSpace: "normal"
      })

      const request = { maxWidth: 720, lineHeight: 24 }
      const baselineSummary = Text.layout(prepared, request)
      const projection = projectObstacleTextLayout({
        baselineSummary,
        obstacles: entry.scene.obstacles,
        prepared,
        request
      })
      const rightObstacles = Arr.sort(
        Arr.filter(projection.obstacles, (obstacle) => obstacle.placement === "right"),
        obstacleLineStartOrder
      )
      const lastRightObstacle = Arr.last(rightObstacles)

      expect(rightObstacles.length).toBeGreaterThan(1)
      expect(nonOverlappingBands(rightObstacles)).toBe(true)
      expect(Option.isSome(lastRightObstacle)).toBe(true)
      expect(projection.canvasHeightPx).toBeGreaterThanOrEqual(
        Option.getOrElse(
          lastRightObstacle,
          () => ({ topPx: 0, heightPx: 0 })
        ).topPx + Option.getOrElse(lastRightObstacle, () => ({ topPx: 0, heightPx: 0 })).heightPx
      )
    }).pipe(Effect.provide(Text.TextLayoutLive)))

  it.effect("keeps the generic custom scene geometrically valid", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text:
          "Custom copy still needs believable rails so the same prepared text can be projected through a neutral but structurally honest layout.",
        font: reflowTestFont,
        whiteSpace: "normal"
      })

      const request = { maxWidth: 280, lineHeight: 24 }
      const baselineSummary = Text.layout(prepared, request)
      const projection = projectObstacleTextLayout({
        baselineSummary,
        obstacles: customTextScene.obstacles,
        prepared,
        request
      })

      expect(Arr.every(projection.lines, (line) => line.width <= line.availableWidthPx)).toBe(true)
      expect(projection.canvasHeightPx).toBeGreaterThanOrEqual(projection.summary.height)
    }).pipe(Effect.provide(Text.TextLayoutLive)))
})
