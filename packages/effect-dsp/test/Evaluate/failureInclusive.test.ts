import { expect, it } from "@effect/vitest"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Deferred, Effect, Exit, Fiber, Option, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { TestClock } from "effect/testing"

class Rejected extends Schema.TaggedError<Rejected>()("Rejected", {}) {}
const row = (question: string) => new Example({ input: { question }, labels: Option.some({ answer: "yes" }) })
const setup = Effect.gen(function*() {
  const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
  const module = yield* Module.predict("qa", signature)
  const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "yes" }))
  return { module, mock }
})
const metric = Metric.withFeedback((example) =>
  example.input.question === "bad"
    ? Effect.fail(new Rejected())
    : Effect.succeed(new Metric.Score({ value: 1, feedback: Option.some("correct") }))
)

it.effect("includes failures in the denominator and reports ordered prediction evidence", () =>
  Effect.gen(function*() {
    const { module, mock } = yield* setup
    const report = yield* Evaluate.run(
      new Evaluate.Options({
        module,
        examples: [row("good"), row("bad")],
        metrics: { accuracy: metric }
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(report.average).toBe(0.5)
    expect(report.overallScores.accuracy).toBe(0.5)
    expect(report.units).toBe("fraction")
    expect(Evaluate.asPercent(report)).toBe(50)
    expect(Arr.map(report.outcomes, (outcome) => outcome._tag)).toEqual(["Scored", "Failed"])
    const scored = Option.getOrThrow(Arr.head(report.outcomes))
    if (scored._tag === "Scored") {
      expect(scored.prediction.output).toEqual({ answer: "yes" })
      expect(scored.score.value).toBe(1)
      expect(scored.prediction.usage.callCount).toBe(1)
    }
    const penalty = yield* Evaluate.run(
      new Evaluate.Options({
        module,
        examples: [row("good"), row("bad")],
        metrics: { accuracy: metric },
        failureScore: -0.4
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(penalty.average).toBe(0.3)
  }))

it.effect("enforces maxErrors and retains every failure when unlimited", () =>
  Effect.gen(function*() {
    const { module, mock } = yield* setup
    const failure = yield* Evaluate.run(
      new Evaluate.Options({
        module,
        examples: [row("bad")],
        metrics: { accuracy: metric },
        maxErrors: Option.some(1)
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)
    expect(failure).toEqual(new Evaluate.TooManyErrors({ count: 1, limit: 1 }))
    const tolerated = yield* Evaluate.run(
      new Evaluate.Options({
        module,
        examples: [row("bad")],
        metrics: { accuracy: metric },
        maxErrors: Option.some(2)
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(tolerated.failureCount).toBe(1)
    const report = yield* Evaluate.run(
      new Evaluate.Options({
        module,
        examples: Arr.replicate(row("bad"), 10),
        metrics: { accuracy: metric },
        maxErrors: Option.none()
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(report.outcomes).toHaveLength(10)
    expect(Arr.every(report.outcomes, (outcome) => outcome._tag === "Failed")).toBe(true)
    expect(report.average).toBe(0)
  }))

it.effect("preserves twenty input positions with four concurrent scorers", () =>
  Effect.gen(function*() {
    const { module, mock } = yield* setup
    const rows = Arr.makeBy(20, (index) =>
      new Example({ input: { question: `q-${index}` }, labels: Option.some({ index }) }))
    const delayed = Metric.withFeedback((example) =>
      Effect.gen(function*() {
        const { index } = yield* Schema.decodeUnknownEffect(Schema.Struct({ index: Schema.Int }))(
          Option.getOrThrow(example.labels)
        )
        yield* Effect.sleep((20 - index) * 10)
        return new Metric.Score({ value: index / 20, feedback: Option.none() })
      })
    )
    const fiber = yield* Evaluate.run(
      new Evaluate.Options({ module, examples: rows, metrics: { accuracy: delayed }, concurrency: 4 })
    )
      .pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.forkChild)
    yield* TestClock.adjust("5 seconds")
    const report = yield* Fiber.join(fiber)
    expect(Arr.map(report.outcomes, (outcome) =>
      outcome.example.input.question)).toEqual(Arr.map(rows, (example) =>
        example.input.question))
    expect(report.average).toBeCloseTo(0.475)
  }))

it.effect("propagates interruption through a pending scorer and runs its finalizer", () =>
  Effect.gen(function*() {
    const { module, mock } = yield* setup
    const started = yield* Deferred.make<void>()
    const finalized = yield* Ref.make(false)
    const pending = Metric.withFeedback(() =>
      Effect.acquireUseRelease(
        Deferred.succeed(started, undefined),
        () => Effect.sleep("1 hour").pipe(Effect.andThen(Effect.never)),
        () => Ref.set(finalized, true)
      )
    )
    const fiber = yield* Evaluate.run(new Evaluate.Options({ module, examples: [row("good")], metrics: { pending } }))
      .pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.forkChild)
    yield* Deferred.await(started)
    yield* TestClock.adjust("1 second")
    yield* Fiber.interrupt(fiber)
    expect(Exit.hasInterrupts(yield* Fiber.await(fiber))).toBe(true)
    expect(yield* Ref.get(finalized)).toBe(true)
  }))
