import { expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import { Example, Id } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as ParameterSet from "@scenesystems/effect-dsp/ParameterSet"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { Array as Arr, Boolean as Bool, Effect, Option, Record, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { assertNoMutation } from "../kit/Mutation.js"

const row = (id: string) =>
  new Example({ id: Option.some(Id.make(id)), input: { question: id }, labels: Option.some({ answer: `label-${id}` }) })
const setup = Effect.gen(function*() {
  const module = yield* Module.predict(
    "qa",
    yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
  )
  const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "teacher" }))
  return { module, mock }
})

it.effect("stops at the trace cap and fills only remaining labeled slots from unbootstrapped examples", () =>
  Effect.gen(function*() {
    const { module } = yield* setup
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.succeed("[[ ## answer ## ]]\nteacher\n[[ ## completed ## ]]")
    )
    const result = yield* assertNoMutation(
      module,
      BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset: [row("a"), row("b"), row("c"), row("d")],
          metric: Metric.fromSync(() => 1),
          maxBootstrappedDemos: 1,
          maxLabeledDemos: 3
        })
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const demos = Option.getOrThrow(Record.get(result.parameters, "qa")).demos
    expect(demos).toHaveLength(3)
    expect(Option.getOrThrow(Arr.head(demos)).output).toEqual({ answer: "teacher" })
    expect(Arr.some(Arr.drop(demos, 1), (demo) => Option.contains(Id.make("a"))(demo.exampleId))).toBe(false)
    expect(yield* Ref.get(mock.calls)).toHaveLength(1)
    expect(result.report.demoSources.qa?.bootstrapped).toEqual(["a"])
    expect(result.report.demoSources.qa?.labeled).toHaveLength(2)
  }))

it.effect("returns a valid empty result when every score rejects and labeled capacity is zero", () =>
  Effect.gen(function*() {
    const { module, mock } = yield* setup
    const result = yield* BootstrapFewShot.run(
      new BootstrapFewShot.Options({
        module,
        trainset: [row("a")],
        metric: Metric.fromSync(() => 0),
        maxLabeledDemos: 0
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(Option.getOrThrow(Record.get(result.parameters, "qa")).demos).toEqual([])
    expect(result.report.acceptedCount).toBe(0)
    expect(result.report.rejectedCount).toBe(1)
  }))

it.effect("retries rejected examples with rollout identity and temperature rather than prompt mutations", () =>
  Effect.gen(function*() {
    const { module, mock } = yield* setup
    const scored = yield* Ref.make(0)
    const result = yield* BootstrapFewShot.run(
      new BootstrapFewShot.Options({
        module,
        trainset: [row("a")],
        maxRounds: 2,
        maxLabeledDemos: 0,
        metric: Metric.withFeedback(() =>
          Ref.updateAndGet(scored, (n) => n + 1).pipe(
            Effect.map((n) =>
              new Metric.Score({
                value: Bool.match(n === 1, { onFalse: () => 1, onTrue: () => 0 }),
                feedback: Option.none()
              })
            )
          )
        )
      })
    ).pipe(ModelBinder.withBinder(mock.binder), Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const calls = yield* Ref.get(mock.calls)
    expect(Arr.map(calls, (call) => call.rolloutId)).toEqual([Option.none(), Option.some(1)])
    expect(Option.getOrThrow(Arr.last(calls)).settings.temperature).toBe(1)
    expect(Option.getOrThrow(Arr.head(calls)).prompt).toBe(Option.getOrThrow(Arr.last(calls)).prompt)
    expect(result.report.roundsUsed).toBe(2)
    expect(result.report.acceptedCount).toBe(1)
  }))

it.effect("does not validate unused labeled rows when bootstrapped demos fill the capacity", () =>
  Effect.gen(function*() {
    const { module, mock } = yield* setup
    const teacher = Module.bound(module, yield* ParameterSet.snapshot(module))
    const result = yield* BootstrapFewShot.run(
      new BootstrapFewShot.Options({
        module,
        teacher,
        trainset: [row("a"), new Example({ input: { unrelated: "unused" }, labels: Option.some({ answer: "label" }) })],
        metric: Metric.fromSync(() => 1),
        maxBootstrappedDemos: 1,
        maxLabeledDemos: 1
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(Option.getOrThrow(Record.get(result.parameters, "qa")).demos).toHaveLength(1)
    expect(result.report.labeledCount).toBe(0)
  }))
