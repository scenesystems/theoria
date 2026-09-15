import { describe, expect, it } from "@effect/vitest"
import type { Context } from "effect"
import {
  Boolean,
  Cause,
  Effect,
  Either,
  Equal,
  Exit,
  Layer,
  Match,
  MutableRef,
  Number,
  Option,
  Ref,
  Schema,
  String,
  Tuple
} from "effect"
import * as Arr from "effect/Array"

import { Browser, Contracts, Errors, Text } from "../../src/index.js"

const browserProfile = Browser.DefaultBrowserSupportProfile
const originalFont = "10px monospace"
const measurementFont: Text.FontDescriptorType = {
  family: browserProfile.defaultFontFamily,
  size: 12
}
const assignedFont = String.concat("12px ", browserProfile.defaultFontFamily)

class MonospaceCanvasContext {
  direction: Browser.CanvasTextDirectionType = "inherit"
  font = originalFont
  textBaseline: Browser.CanvasTextBaselineType = "alphabetic"
  readonly advance = MutableRef.make(10)
  readonly calls = MutableRef.make(0)

  measureText(text: string): Browser.CanvasTextMetricsType {
    MutableRef.incrementAndGet(this.calls)
    return { width: Number.multiply(String.length(text), MutableRef.get(this.advance)) }
  }
}

class EmojiCanvasContext {
  direction: Browser.CanvasTextDirectionType = "inherit"
  font = "10px monospace"
  textBaseline: Browser.CanvasTextBaselineType = "alphabetic"

  measureText(text: string): Browser.CanvasTextMetricsType {
    return {
      width: Match.value(text).pipe(
        Match.when("🙂", () => 4),
        Match.when("AB", () => 20),
        Match.when("A🙂B", () => 22),
        Match.orElse((measured) => Number.multiply(String.length(measured), 10))
      )
    }
  }
}

class ThrowingCanvasContext {
  direction: Browser.CanvasTextDirectionType = "inherit"
  font = originalFont
  textBaseline: Browser.CanvasTextBaselineType = "alphabetic"

  measureText(text: string): Browser.CanvasTextMetricsType {
    return Schema.decodeUnknownSync(Schema.Never)(text)
  }
}

class AssignmentFailingCanvasContext {
  readonly directionState = MutableRef.make<Browser.CanvasTextDirectionType>("inherit")
  font = originalFont
  readonly measureCalls = MutableRef.make(0)
  readonly restorations = MutableRef.make(0)
  textBaseline: Browser.CanvasTextBaselineType = "alphabetic"

  get direction(): Browser.CanvasTextDirectionType {
    return MutableRef.get(this.directionState)
  }

  set direction(value: Browser.CanvasTextDirectionType) {
    Match.value(value).pipe(
      Match.when("inherit", (restored) => {
        MutableRef.incrementAndGet(this.restorations)
        MutableRef.set(this.directionState, restored)
      }),
      Match.orElse((assigned) => Schema.decodeUnknownSync(Schema.Never)(assigned))
    )
  }

  measureText(text: string): Browser.CanvasTextMetricsType {
    MutableRef.incrementAndGet(this.measureCalls)
    return { width: Number.multiply(String.length(text), 10) }
  }
}

class ObservingCanvasContext {
  direction: Browser.CanvasTextDirectionType = "inherit"
  font = originalFont
  readonly observedDirection = MutableRef.make<Browser.CanvasTextDirectionType>("inherit")
  readonly observedFont = MutableRef.make(originalFont)
  readonly observedTextBaseline = MutableRef.make<Browser.CanvasTextBaselineType>("alphabetic")
  textBaseline: Browser.CanvasTextBaselineType = "alphabetic"

  measureText(text: string): Browser.CanvasTextMetricsType {
    MutableRef.set(this.observedDirection, this.direction)
    MutableRef.set(this.observedFont, this.font)
    MutableRef.set(this.observedTextBaseline, this.textBaseline)
    return { width: Number.multiply(String.length(text), 10) }
  }
}

class RestorationFailingCanvasContext {
  direction: Browser.CanvasTextDirectionType = "inherit"
  readonly fontState = MutableRef.make(originalFont)
  textBaseline: Browser.CanvasTextBaselineType = "alphabetic"

  get font(): string {
    return MutableRef.get(this.fontState)
  }

  set font(value: string) {
    Match.value(value).pipe(
      Match.when(originalFont, (restored) => Schema.decodeUnknownSync(Schema.Never)(restored)),
      Match.orElse((assigned) => MutableRef.set(this.fontState, assigned))
    )
  }

  measureText(text: string): Browser.CanvasTextMetricsType {
    return { width: Number.multiply(String.length(text), 10) }
  }
}

class MeasurementAndRestorationFailingCanvasContext extends RestorationFailingCanvasContext {
  override measureText(text: string): Browser.CanvasTextMetricsType {
    return Schema.decodeUnknownSync(Schema.Never)(text)
  }
}

class MeasurementFailureSummary extends Schema.Class<MeasurementFailureSummary>(
  "effect-text/test/MeasurementFailureSummary"
)({
  defects: Schema.Array(Schema.Unknown),
  failures: Schema.Array(Errors.MeasurementFailed)
}) {}

const measureCanvasDirectly = (
  context: Browser.CanvasMeasurementContext,
  text: string,
  emojiCorrection: Option.Option<Browser.EmojiCorrectionType> = Option.none()
) =>
  Contracts.TextMeasurer.pipe(
    Effect.flatMap((measurer) => measurer.measure(measurementFont, text)),
    Effect.provide(
      Option.match(emojiCorrection, {
        onNone: () => Browser.CanvasTextMeasurerLive({ context, direction: "rtl", textBaseline: "top" }),
        onSome: (configuration) =>
          Browser.CanvasTextMeasurerLive({
            context,
            direction: "rtl",
            emojiCorrection: configuration,
            textBaseline: "top"
          })
      })
    )
  )

const measureDirectly = (context: Browser.CanvasMeasurementContext) => measureCanvasDirectly(context, "alpha")

const summarizeMeasurementExit = (
  exit: Exit.Exit<number, Errors.MeasurementFailed>
): MeasurementFailureSummary =>
  Exit.match(exit, {
    onFailure: (cause) =>
      new MeasurementFailureSummary({
        defects: Arr.fromIterable(Cause.defects(cause)),
        failures: Arr.fromIterable(Cause.failures(cause))
      }),
    onSuccess: () => new MeasurementFailureSummary({ defects: Arr.empty(), failures: Arr.empty() })
  })

const browserLayer = (
  context: Browser.CanvasMeasurementContext,
  revision: Browser.FontReadinessRevisionType,
  emojiCorrection: Option.Option<Browser.EmojiCorrectionType> = Option.none()
) =>
  Layer.mergeAll(
    Text.WordSegmenterLive,
    Layer.succeed(Contracts.EngineProfile, browserProfile.engineProfile),
    Browser.BrowserMeasurementCacheLive({
      fontReadinessRevision: revision,
      profileId: browserProfile.id
    }).pipe(
      Layer.provide(
        Option.match(emojiCorrection, {
          onNone: () => Browser.CanvasTextMeasurerLive({ context }),
          onSome: (configuration) => Browser.CanvasTextMeasurerLive({ context, emojiCorrection: configuration })
        })
      )
    )
  )

const prepareInput = (text: string): Text.PrepareInputType => ({
  text,
  font: { family: browserProfile.defaultFontFamily, size: 12 },
  whiteSpace: "normal"
})

const measuredWidth = (
  input: Text.PrepareInputType,
  layer: Layer.Layer<Contracts.EngineProfile | Contracts.MeasurementCache | Contracts.WordSegmenter>
) =>
  Text.prepare(input).pipe(
    Effect.provide(layer),
    Effect.map((prepared) => Text.layout(prepared, { maxWidth: 500, lineHeight: 12 }).maxLineWidth)
  )

describe("Text browser runtime contracts", () => {
  it.effect("serializes concurrent canvas access and restores approved host state", () =>
    Effect.gen(function*() {
      const context = new MonospaceCanvasContext()
      const inputs = Arr.map(Arr.make("alpha", "beta", "gamma", "delta"), prepareInput)

      const widths = yield* Effect.forEach(
        inputs,
        (input) =>
          Text.prepare(input).pipe(
            Effect.map((prepared) => Text.layout(prepared, { maxWidth: 500, lineHeight: 12 }).maxLineWidth)
          ),
        { concurrency: "unbounded" }
      ).pipe(Effect.provide(browserLayer(context, Browser.initialFontReadinessRevision())))

      expect(Number.greaterThan(MutableRef.get(context.calls), 0)).toBe(true)
      expect(context.font).toBe("10px monospace")
      expect(context.direction).toBe("inherit")
      expect(context.textBaseline).toBe("alphabetic")
      expect(Arr.every(widths, Number.greaterThan(0))).toBe(true)
    }))

  it.effect("preserves absent, disabled, default, and custom emoji correction", () =>
    Effect.gen(function*() {
      const custom: Browser.EmojiCorrectionType = {
        minimumAdvanceMultiplier: 2,
        probe: "🙂"
      }
      const widths = yield* Effect.all({
        absent: measureCanvasDirectly(new EmojiCanvasContext(), "A🙂B"),
        disabled: measureCanvasDirectly(new EmojiCanvasContext(), "A🙂B", Option.some(false)),
        defaulted: measureCanvasDirectly(new EmojiCanvasContext(), "A🙂B", Option.some(true)),
        custom: measureCanvasDirectly(new EmojiCanvasContext(), "A🙂B", Option.some(custom))
      })

      expect(widths.absent).toBe(22)
      expect(widths.disabled).toBe(22)
      expect(widths.defaulted).toBe(32)
      expect(widths.custom).toBe(44)
    }))

  it.effect("uses a font-readiness revision to invalidate cached widths", () =>
    Effect.gen(function*() {
      const context = new MonospaceCanvasContext()
      const input = prepareInput("alpha")
      const baseRevision = Browser.initialFontReadinessRevision()
      const request = { maxWidth: 500, lineHeight: 12 }

      const stale = yield* Effect.gen(function*() {
        const before = yield* Text.prepare(input).pipe(
          Effect.map((prepared) => Text.layout(prepared, request).maxLineWidth)
        )
        MutableRef.set(context.advance, 20)
        const afterHostChange = yield* Text.prepare(input).pipe(
          Effect.map((prepared) => Text.layout(prepared, request).maxLineWidth)
        )
        return Arr.make(before, afterHostChange)
      }).pipe(Effect.provide(browserLayer(context, baseRevision)))

      const refreshed = yield* measuredWidth(
        input,
        browserLayer(context, Browser.incrementFontReadinessRevision(baseRevision))
      )

      expect(stale).toEqual(Arr.make(50, 50))
      expect(refreshed).toBe(100)
    }))

  it.effect("captures a throwing public host boundary as MeasurementFailed and restores state", () =>
    Effect.gen(function*() {
      const context = new ThrowingCanvasContext()
      const failure = yield* Effect.flip(
        Text.prepare(prepareInput("alpha")).pipe(
          Effect.provide(browserLayer(context, Browser.initialFontReadinessRevision()))
        )
      )

      expect(Schema.is(Errors.MeasurementFailed)(failure)).toBe(true)
      expect(failure.text).toBe("alpha")
      expect(String.startsWith("measureText failed:")(failure.reason)).toBe(true)
      expect(context.font).toBe("10px monospace")
      expect(context.direction).toBe("inherit")
      expect(context.textBaseline).toBe("alphabetic")
    }))

  it.effect("applies requested state only for measurement and then restores the snapshot", () =>
    Effect.gen(function*() {
      const context = new ObservingCanvasContext()
      const width = yield* measureDirectly(context)

      expect(width).toBe(50)
      expect(MutableRef.get(context.observedFont)).toBe(assignedFont)
      expect(MutableRef.get(context.observedDirection)).toBe("rtl")
      expect(MutableRef.get(context.observedTextBaseline)).toBe("top")
      expect(context.font).toBe(originalFont)
      expect(context.direction).toBe("inherit")
      expect(context.textBaseline).toBe("alphabetic")
    }))

  it.effect("restores the snapshot after canvas state assignment fails", () =>
    Effect.gen(function*() {
      const context = new AssignmentFailingCanvasContext()
      const exit = yield* measureDirectly(context).pipe(Effect.exit)
      const summary = summarizeMeasurementExit(exit)

      expect(Arr.length(summary.failures)).toBe(1)
      expect(Arr.every(summary.failures, Schema.is(Errors.MeasurementFailed))).toBe(true)
      expect(
        Arr.every(summary.failures, (failure) => String.startsWith("canvas state assignment failed:")(failure.reason))
      )
        .toBe(true)
      expect(Equal.equals(Arr.length(summary.defects), 0)).toBe(true)
      expect(MutableRef.get(context.restorations)).toBe(1)
      expect(MutableRef.get(context.measureCalls)).toBe(0)
      expect(context.font).toBe(originalFont)
      expect(context.direction).toBe("inherit")
      expect(context.textBaseline).toBe("alphabetic")
    }))

  it.effect("keeps a restoration-only host failure in the typed error channel", () =>
    Effect.gen(function*() {
      const context = new RestorationFailingCanvasContext()
      const exit = yield* measureDirectly(context).pipe(Effect.exit)
      const summary = summarizeMeasurementExit(exit)

      expect(Arr.length(summary.failures)).toBe(1)
      expect(Arr.every(summary.failures, Schema.is(Errors.MeasurementFailed))).toBe(true)
      expect(
        Arr.every(summary.failures, (failure) => String.startsWith("canvas state restoration failed:")(failure.reason))
      )
        .toBe(true)
      expect(Equal.equals(Arr.length(summary.defects), 0)).toBe(true)
      expect(context.font).toBe(assignedFont)
      expect(context.direction).toBe("rtl")
      expect(context.textBaseline).toBe("top")
    }))

  it.effect("preserves measurement and restoration failures in sequence", () =>
    Effect.gen(function*() {
      const context = new MeasurementAndRestorationFailingCanvasContext()
      const exit = yield* measureDirectly(context).pipe(Effect.exit)
      const summary = summarizeMeasurementExit(exit)

      expect(Arr.length(summary.failures)).toBe(2)
      expect(Arr.every(summary.failures, Schema.is(Errors.MeasurementFailed))).toBe(true)
      expect(
        Arr.map(summary.failures, (failure) =>
          Tuple.make(
            String.startsWith("measureText failed:")(failure.reason),
            String.startsWith("canvas state restoration failed:")(failure.reason)
          ))
      ).toEqual(Arr.make(
        Tuple.make(true, false),
        Tuple.make(false, true)
      ))
      expect(Equal.equals(Arr.length(summary.defects), 0)).toBe(true)
    }))

  it.effect("evicts failed measurements from deterministic and browser caches", () =>
    Effect.gen(function*() {
      const input = prepareInput("alpha")
      const failingOnce = Layer.effect(
        Contracts.TextMeasurer,
        Ref.make(0).pipe(
          Effect.map((calls): Context.Tag.Service<typeof Contracts.TextMeasurer> => ({
            measure: (font: Text.FontDescriptorType, text: string) =>
              Ref.updateAndGet(calls, Number.increment).pipe(
                Effect.flatMap((count) =>
                  Boolean.match(Equal.equals(count, 1), {
                    onFalse: () => Effect.succeed(Number.multiply(String.length(text), 10)),
                    onTrue: () =>
                      Effect.fail(
                        new Errors.MeasurementFailed({
                          fontFamily: font.family,
                          fontSize: font.size,
                          text,
                          reason: "font not ready"
                        })
                      )
                  })
                )
              )
          }))
        )
      )
      const cacheLayers = Arr.make(
        Text.MeasurementCacheLive.pipe(Layer.provide(failingOnce)),
        Browser.BrowserMeasurementCacheLive({
          fontReadinessRevision: Browser.initialFontReadinessRevision(),
          profileId: browserProfile.id
        }).pipe(Layer.provide(failingOnce))
      )

      const outcomes = yield* Effect.forEach(cacheLayers, (cacheLayer) =>
        Effect.gen(function*() {
          const first = yield* Effect.either(Text.prepare(input))
          const second = yield* Text.prepare(input)
          return { first, width: Text.layout(second, { maxWidth: 500, lineHeight: 12 }).maxLineWidth }
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              Text.WordSegmenterLive,
              Layer.succeed(Contracts.EngineProfile, browserProfile.engineProfile),
              cacheLayer
            )
          )
        ))

      expect(Arr.map(outcomes, (outcome) => Either.isLeft(outcome.first))).toEqual(Arr.make(true, true))
      expect(Arr.map(outcomes, (outcome) => outcome.width)).toEqual(Arr.make(50, 50))
    }))
})
