import { describe, expect, it } from "@effect/vitest"
import { Cause, Effect, Either, Exit, Match, MutableRef, Number, Option, Schema, String, Tuple } from "effect"
import * as Arr from "effect/Array"

import * as CanvasTextMeasurer from "../../src/CanvasTextMeasurer.js"
import type * as Text from "../../src/Text.js"
import * as TextMeasurer from "../../src/TextMeasurer.js"

const font: Text.Font = { family: "Mono", size: 12 }
const originalFont = "10px monospace"

class ObservingContext {
  direction: CanvasTextMeasurer.Direction = "inherit"
  font = originalFont
  readonly observedDirection = MutableRef.make<CanvasTextMeasurer.Direction>("inherit")
  readonly observedFont = MutableRef.make(originalFont)
  readonly observedBaseline = MutableRef.make<CanvasTextMeasurer.Baseline>("alphabetic")
  textBaseline: CanvasTextMeasurer.Baseline = "alphabetic"

  measureText(text: string): CanvasTextMeasurer.Metrics {
    MutableRef.set(this.observedDirection, this.direction)
    MutableRef.set(this.observedFont, this.font)
    MutableRef.set(this.observedBaseline, this.textBaseline)
    return { width: Number.multiply(String.length(text), 10) }
  }
}

class EmojiContext {
  direction: CanvasTextMeasurer.Direction = "inherit"
  font = originalFont
  textBaseline: CanvasTextMeasurer.Baseline = "alphabetic"

  measureText(text: string): CanvasTextMeasurer.Metrics {
    return {
      width: Match.value(text).pipe(
        Match.when("🙂", () => 4),
        Match.when("AB", () => 20),
        Match.when("A\u0301B", () => 90),
        Match.when(
          Match.is(
            "A🙂B",
            "A🙂\u0301B",
            "A👩‍👩‍👧‍👦B",
            "A🇺🇸B",
            "A1⃣B",
            "A1️⃣B",
            "A1B",
            "A🇺B",
            "A1\u0301B"
          ),
          () => 22
        ),
        Match.orElse((measured) => Number.multiply(String.length(measured), 10))
      )
    }
  }
}

class FailingProbeContext extends EmojiContext {
  readonly probeCalls = MutableRef.make(0)

  override measureText(text: string): CanvasTextMeasurer.Metrics {
    return Match.value(text).pipe(
      Match.when("🙂", (probe) =>
        Match.value(MutableRef.incrementAndGet(this.probeCalls)).pipe(
          Match.when(1, () => Schema.decodeUnknownSync(Schema.Never)(probe)),
          Match.orElse(() => super.measureText(probe))
        )),
      Match.orElse((measured) => super.measureText(measured))
    )
  }
}

class ThrowingContext {
  direction: CanvasTextMeasurer.Direction = "inherit"
  font = originalFont
  textBaseline: CanvasTextMeasurer.Baseline = "alphabetic"

  measureText(text: string): CanvasTextMeasurer.Metrics {
    return Schema.decodeUnknownSync(Schema.Never)(text)
  }
}

class AssignmentFailingContext {
  readonly directionState = MutableRef.make<CanvasTextMeasurer.Direction>("inherit")
  font = originalFont
  readonly measureCalls = MutableRef.make(0)
  readonly restorations = MutableRef.make(0)
  textBaseline: CanvasTextMeasurer.Baseline = "alphabetic"

  get direction(): CanvasTextMeasurer.Direction {
    return MutableRef.get(this.directionState)
  }

  set direction(value: CanvasTextMeasurer.Direction) {
    Match.value(value).pipe(
      Match.when("inherit", (restored) => {
        MutableRef.incrementAndGet(this.restorations)
        MutableRef.set(this.directionState, restored)
      }),
      Match.orElse((assigned) => Schema.decodeUnknownSync(Schema.Never)(assigned))
    )
  }

  measureText(text: string): CanvasTextMeasurer.Metrics {
    MutableRef.incrementAndGet(this.measureCalls)
    return { width: Number.multiply(String.length(text), 10) }
  }
}

class RestorationFailingContext {
  direction: CanvasTextMeasurer.Direction = "inherit"
  readonly fontState = MutableRef.make(originalFont)
  textBaseline: CanvasTextMeasurer.Baseline = "alphabetic"

  get font(): string {
    return MutableRef.get(this.fontState)
  }

  set font(value: string) {
    Match.value(value).pipe(
      Match.when(originalFont, (restored) => Schema.decodeUnknownSync(Schema.Never)(restored)),
      Match.orElse((assigned) => MutableRef.set(this.fontState, assigned))
    )
  }

  measureText(text: string): CanvasTextMeasurer.Metrics {
    return { width: Number.multiply(String.length(text), 10) }
  }
}

class MeasurementAndRestorationFailingContext extends RestorationFailingContext {
  override measureText(text: string): CanvasTextMeasurer.Metrics {
    return Schema.decodeUnknownSync(Schema.Never)(text)
  }
}

const measureEffect = (text: string) =>
  TextMeasurer.TextMeasurer.pipe(Effect.flatMap((service) => service.measure(font, text)))

const canvasLayer = (
  context: CanvasTextMeasurer.Context,
  correction: Option.Option<CanvasTextMeasurer.EmojiCorrection> = Option.none()
) =>
  CanvasTextMeasurer.layer(
    new CanvasTextMeasurer.Options({
      context,
      direction: "rtl",
      textBaseline: "top",
      ...Option.match(correction, {
        onNone: () => ({}),
        onSome: (emojiCorrection) => ({ emojiCorrection })
      })
    })
  )

const measure = (
  context: CanvasTextMeasurer.Context,
  text: string,
  correction: Option.Option<CanvasTextMeasurer.EmojiCorrection> = Option.none()
) => measureEffect(text).pipe(Effect.provide(canvasLayer(context, correction)))

const failures = (exit: Exit.Exit<number, TextMeasurer.Failed>) =>
  Exit.match(exit, {
    onFailure: (cause) => Arr.fromIterable(Cause.failures(cause)),
    onSuccess: () => Arr.empty<TextMeasurer.Failed>()
  })

describe("CanvasTextMeasurer", () => {
  it.effect("applies requested state only while measuring and restores it afterward", () =>
    Effect.gen(function*() {
      const context = new ObservingContext()
      const widths = yield* Effect.forEach(Arr.make("alpha", "beta", "gamma"), measureEffect, {
        concurrency: "unbounded"
      }).pipe(Effect.provide(canvasLayer(context)))

      expect(widths).toEqual(Arr.make(50, 40, 50))
      expect(MutableRef.get(context.observedFont)).toBe("12px Mono")
      expect(MutableRef.get(context.observedDirection)).toBe("rtl")
      expect(MutableRef.get(context.observedBaseline)).toBe("top")
      expect(context.font).toBe(originalFont)
      expect(context.direction).toBe("inherit")
      expect(context.textBaseline).toBe("alphabetic")
    }))

  it.effect("preserves absent, disabled, default, and custom emoji correction", () =>
    Effect.gen(function*() {
      const widths = yield* Effect.all({
        absent: measure(new EmojiContext(), "A🙂B"),
        disabled: measure(new EmojiContext(), "A🙂B", Option.some(false)),
        defaulted: measure(new EmojiContext(), "A🙂B", Option.some(true)),
        custom: measure(new EmojiContext(), "A🙂B", Option.some({ probe: "🙂", minimumAdvanceMultiplier: 2 }))
      })

      expect(widths).toEqual({ absent: 22, disabled: 22, defaulted: 32, custom: 44 })
    }))

  it.effect("corrects regional-indicator flags and keycaps as complete emoji graphemes", () =>
    Effect.gen(function*() {
      const context = new EmojiContext()
      const widths = yield* Effect.all({
        flag: measureEffect("A🇺🇸B"),
        keycap: measureEffect("A1⃣B"),
        keycapWithVariationSelector: measureEffect("A1️⃣B")
      }).pipe(Effect.provide(canvasLayer(context, Option.some(true))))

      expect(widths).toEqual({ flag: 32, keycap: 32, keycapWithVariationSelector: 32 })
    }))

  it.effect("does not treat emoji-property bases or incomplete sequences as emoji graphemes", () =>
    Effect.gen(function*() {
      const context = new EmojiContext()
      const widths = yield* Effect.all({
        digit: measureEffect("A1B"),
        loneRegionalIndicator: measureEffect("A🇺B"),
        unrelatedCombiningSequence: measureEffect("A1\u0301B")
      }).pipe(Effect.provide(canvasLayer(context, Option.some(true))))

      expect(widths).toEqual({ digit: 22, loneRegionalIndicator: 22, unrelatedCombiningSequence: 22 })
    }))

  it.effect("corrects combining and ZWJ emoji clusters once and restores context state", () =>
    Effect.gen(function*() {
      const context = new EmojiContext()
      const widths = yield* Effect.all({
        combining: measureEffect("A🙂\u0301B"),
        zwj: measureEffect("A👩‍👩‍👧‍👦B")
      }).pipe(Effect.provide(canvasLayer(context, Option.some(true))))

      expect(widths).toEqual({ combining: 32, zwj: 32 })
      expect(context.font).toBe(originalFont)
      expect(context.direction).toBe("inherit")
      expect(context.textBaseline).toBe("alphabetic")
    }))

  it.effect("evicts a failed emoji probe so the next reader can retry", () => {
    const context = new FailingProbeContext()
    return Effect.gen(function*() {
      const first = yield* Effect.either(measureEffect("A🙂B"))
      const second = yield* measureEffect("A🙂B")

      expect(Either.isLeft(first)).toBe(true)
      expect(second).toBe(32)
      expect(MutableRef.get(context.probeCalls)).toBe(2)
    }).pipe(Effect.provide(canvasLayer(context, Option.some(true))))
  })

  it.effect("captures measureText failures with the stable wire tag and restores state", () =>
    Effect.gen(function*() {
      const context = new ThrowingContext()
      const failure = yield* Effect.flip(measure(context, "alpha"))

      expect(failure._tag).toBe("MeasurementFailed")
      expect(failure.text).toBe("alpha")
      expect(String.startsWith("measureText failed:")(failure.reason)).toBe(true)
      expect(context.font).toBe(originalFont)
      expect(context.direction).toBe("inherit")
      expect(context.textBaseline).toBe("alphabetic")
    }))

  it.effect("restores the snapshot after assignment failure without measuring", () =>
    Effect.gen(function*() {
      const context = new AssignmentFailingContext()
      const failure = yield* Effect.flip(measure(context, "alpha"))

      expect(String.startsWith("canvas state assignment failed:")(failure.reason)).toBe(true)
      expect(MutableRef.get(context.restorations)).toBe(1)
      expect(MutableRef.get(context.measureCalls)).toBe(0)
      expect(context.font).toBe(originalFont)
      expect(context.direction).toBe("inherit")
    }))

  it.effect("keeps a restoration-only host failure in the typed channel", () =>
    Effect.gen(function*() {
      const context = new RestorationFailingContext()
      const failure = yield* Effect.flip(measure(context, "alpha"))

      expect(String.startsWith("canvas state restoration failed:")(failure.reason)).toBe(true)
      expect(context.font).toBe("12px Mono")
      expect(context.direction).toBe("rtl")
      expect(context.textBaseline).toBe("top")
    }))

  it.effect("preserves measurement and restoration failures in sequence", () =>
    Effect.gen(function*() {
      const exit = yield* measure(new MeasurementAndRestorationFailingContext(), "alpha").pipe(Effect.exit)
      expect(Arr.map(failures(exit), (failure) =>
        Tuple.make(
          String.startsWith("measureText failed:")(failure.reason),
          String.startsWith("canvas state restoration failed:")(failure.reason)
        ))).toEqual(Arr.make(Tuple.make(true, false), Tuple.make(false, true)))
    }))
})
